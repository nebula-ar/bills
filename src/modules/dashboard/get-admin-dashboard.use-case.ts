import type { PaymentMethod } from "@/generated/prisma/client";
import { DASHBOARD_RANGE_LABELS, DashboardRange, type DashboardRangeKey } from "@/lib/dashboard-range";

import {
  countDashboardCancelledSales,
  countDashboardBarbers,
  dashboardPaymentMethods,
  findDashboardBusiness,
  findDashboardSales,
  findDashboardServicePrices,
} from "./dashboard.repository";

export type AdminDashboard = Awaited<ReturnType<typeof getAdminDashboard>>;

type DashboardPeriodKey = "today" | "week" | "month" | "year";

type DashboardPeriod = {
  key: DashboardPeriodKey;
  label: string;
  from: Date;
};

export type DashboardRangeInput = {
  range?: DashboardRangeKey;
  from?: Date;
  to?: Date;
};

type ResolvedRange = {
  key: DashboardRangeKey;
  from: Date;
  to: Date;
};

export async function getAdminDashboard(now = new Date(), rangeInput?: DashboardRangeInput) {
  const periods = buildDashboardPeriods(now);
  const periodsByKey = Object.fromEntries(periods.map((period) => [period.key, period])) as Record<DashboardPeriodKey, DashboardPeriod>;
  const selected = resolveDashboardRange(now, rangeInput);
  // El rango personalizado puede empezar antes del año en curso, así que se trae
  // desde la fecha más temprana que se necesite.
  const fetchFrom = selected.from < periodsByKey.year.from ? selected.from : periodsByKey.year.from;

  const [business, sales, barberCount, servicePrices, cancelledSalesToday] = await Promise.all([
    findDashboardBusiness(),
    findDashboardSales({ from: fetchFrom }),
    countDashboardBarbers(),
    findDashboardServicePrices(),
    countDashboardCancelledSales({ from: periodsByKey.today.from }),
  ]);

  const monthSales = sales.filter((sale) => sale.soldAt >= periodsByKey.month.from);
  const selectedSales = sales.filter((sale) => sale.soldAt >= selected.from && sale.soldAt <= selected.to);

  return {
    businessName: business?.name ?? "Barber Bills",
    generatedAt: now,
    kpis: periods.map((period) => {
      const periodSales = sales.filter((sale) => sale.soldAt >= period.from);

      return {
        key: period.key,
        label: period.label,
        total: sumSales(periodSales),
        saleCount: periodSales.length,
      };
    }),
    selectedRange: {
      key: selected.key,
      label: DASHBOARD_RANGE_LABELS[selected.key],
      from: selected.from,
      to: selected.to,
      total: sumSales(selectedSales),
      saleCount: selectedSales.length,
    },
    activeBarberCount: barberCount,
    cancelledSalesToday,
    salesByBranch: toBranchTotals(selectedSales),
    topBarbers: toBarberTotals(monthSales).slice(0, 5),
    paymentBreakdown: toPaymentTotals(selectedSales),
    servicePricesByBranch: toServicePricesByBranch(servicePrices),
    recentSales: selectedSales.slice(0, 8).map((sale) => ({
      id: sale.id,
      soldAt: sale.soldAt,
      total: sale.total,
      branchName: sale.branch.name,
      barberName: sale.barber.name,
      itemSummary: sale.items.map((item) => `${item.description} x${item.quantity}`).join(", "),
      payments: sale.payments.map((payment) => ({
        id: payment.id,
        method: payment.method,
        amount: payment.amount,
      })),
    })),
  };
}

function toServicePricesByBranch(servicePrices: Awaited<ReturnType<typeof findDashboardServicePrices>>) {
  const branches = new Map<
    string,
    {
      branchName: string;
      services: { serviceId: string; serviceName: string; price: number }[];
    }
  >();

  for (const servicePrice of servicePrices) {
    const branch = branches.get(servicePrice.branch.id) ?? {
      branchName: servicePrice.branch.name,
      services: [],
    };

    branch.services.push({
      serviceId: servicePrice.service.id,
      serviceName: servicePrice.service.name,
      price: servicePrice.price,
    });
    branches.set(servicePrice.branch.id, branch);
  }

  return Array.from(branches.entries()).map(([branchId, branch]) => ({
    branchId,
    branchName: branch.branchName,
    services: branch.services.slice(0, 4),
  }));
}

function resolveDashboardRange(now: Date, input?: DashboardRangeInput): ResolvedRange {
  const key = input?.range ?? DashboardRange.Today;
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (key) {
    case DashboardRange.Custom: {
      const from = getStartOfDay(input?.from ?? now);
      const requestedTo = input?.to ? getEndOfDay(input.to) : now;
      // Nunca dejamos un rango invertido (to < from).
      const to = requestedTo < from ? getEndOfDay(from) : requestedTo;

      return { key, from, to };
    }

    case DashboardRange.Last7Days:
      return { key, from: getStartOfDay(addDays(now, -6)), to: now };

    case DashboardRange.Last14Days:
      return { key, from: getStartOfDay(addDays(now, -13)), to: now };

    case DashboardRange.ThisMonth:
      return { key, from: new Date(year, month, 1), to: now };

    case DashboardRange.LastMonth:
      // day 0 del mes actual = último día del mes anterior.
      return { key, from: new Date(year, month - 1, 1), to: getEndOfDay(new Date(year, month, 0)) };

    case DashboardRange.ThisQuarter:
      return { key, from: new Date(year, Math.floor(month / 3) * 3, 1), to: now };

    case DashboardRange.ThisSemester:
      return { key, from: new Date(year, month < 6 ? 0 : 6, 1), to: now };

    case DashboardRange.ThisYear:
      return { key, from: new Date(year, 0, 1), to: now };

    default:
      return { key: DashboardRange.Today, from: getStartOfDay(now), to: now };
  }
}

function buildDashboardPeriods(now: Date): DashboardPeriod[] {
  return [
    { key: "today", label: "Hoy", from: getStartOfDay(now) },
    { key: "week", label: "Semana", from: getStartOfWeek(now) },
    { key: "month", label: "Mes", from: new Date(now.getFullYear(), now.getMonth(), 1) },
    { key: "year", label: "Año", from: new Date(now.getFullYear(), 0, 1) },
  ];
}

function toBranchTotals(sales: Awaited<ReturnType<typeof findDashboardSales>>) {
  const totals = new Map<string, { branchName: string; total: number; saleCount: number }>();

  for (const sale of sales) {
    const current = totals.get(sale.branch.id) ?? {
      branchName: sale.branch.name,
      total: 0,
      saleCount: 0,
    };

    current.total += sale.total;
    current.saleCount += 1;
    totals.set(sale.branch.id, current);
  }

  return Array.from(totals.entries())
    .map(([branchId, total]) => ({ branchId, ...total }))
    .sort((a, b) => b.total - a.total || a.branchName.localeCompare(b.branchName));
}

function toBarberTotals(sales: Awaited<ReturnType<typeof findDashboardSales>>) {
  const totals = new Map<string, { barberName: string; total: number; saleCount: number }>();

  for (const sale of sales) {
    const current = totals.get(sale.barber.id) ?? {
      barberName: sale.barber.name,
      total: 0,
      saleCount: 0,
    };

    current.total += sale.total;
    current.saleCount += 1;
    totals.set(sale.barber.id, current);
  }

  return Array.from(totals.entries())
    .map(([barberId, total]) => ({ barberId, ...total }))
    .sort((a, b) => b.total - a.total || a.barberName.localeCompare(b.barberName));
}

function toPaymentTotals(sales: Awaited<ReturnType<typeof findDashboardSales>>) {
  const totals = new Map<PaymentMethod, number>(dashboardPaymentMethods.map((method) => [method, 0]));

  for (const sale of sales) {
    for (const payment of sale.payments) {
      totals.set(payment.method, (totals.get(payment.method) ?? 0) + payment.amount);
    }
  }

  return Array.from(totals.entries())
    .map(([method, total]) => ({ method, total }))
    .filter((paymentTotal) => paymentTotal.total > 0)
    .sort((a, b) => b.total - a.total);
}

function sumSales(sales: Awaited<ReturnType<typeof findDashboardSales>>) {
  return sales.reduce((total, sale) => total + sale.total, 0);
}

function getStartOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getEndOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);

  return result;
}

function getStartOfWeek(date: Date) {
  const start = getStartOfDay(date);
  const day = start.getDay();
  const diff = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - diff);

  return start;
}
