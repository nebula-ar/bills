import type { PaymentMethod } from "@/generated/prisma/client";
import {
  DASHBOARD_RANGE_LABELS,
  resolveDashboardRange,
  type DashboardRangeInput,
} from "@/lib/dashboard-range";

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

function getStartOfWeek(date: Date) {
  const start = getStartOfDay(date);
  const day = start.getDay();
  const diff = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - diff);

  return start;
}
