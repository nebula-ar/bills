import type { PaymentMethod } from "@/generated/prisma/client";

import { findReportBarbers, findReportSales, paymentMethods } from "./report.repository";

export type SalesReportInput = {
  from?: Date;
  to?: Date;
  barberId?: string;
  paymentMethod?: PaymentMethod;
};

export type TodaySalesReport = {
  from?: Date;
  to?: Date;
  totalSold: number;
  saleCount: number;
  averageTicket: number;
  itemsSold: number;
  comparison: {
    previousTotal: number;
    deltaPct: number | null;
  } | null;
  salesByDay: {
    date: string;
    total: number;
    saleCount: number;
  }[];
  salesByWeekday: {
    weekday: number;
    total: number;
  }[];
  salesByBranch: {
    branchName: string;
    total: number;
    saleCount: number;
  }[];
  topServices: {
    name: string;
    total: number;
    quantity: number;
  }[];
  filters: {
    barberId?: string;
    paymentMethod?: PaymentMethod;
  };
  options: {
    barbers: {
      id: string;
      name: string;
    }[];
    paymentMethods: PaymentMethod[];
  };
  totalsByBarber: {
    barberId: string;
    barberName: string;
    total: number;
    saleCount: number;
  }[];
  totalsByPaymentMethod: {
    method: PaymentMethod;
    total: number;
  }[];
  latestSales: {
    id: string;
    soldAt: Date;
    total: number;
    branchName: string;
    barberName: string;
    items: {
      id: string;
      description: string;
      quantity: number;
      total: number;
    }[];
    payments: {
      id: string;
      method: PaymentMethod;
      amount: number;
    }[];
  }[];
};

export async function getTodaySalesReport(input: SalesReportInput = {}): Promise<TodaySalesReport> {
  const dateRange = resolveDateRange(input);
  const previousRange = buildPreviousRange(dateRange);
  const [sales, barbers, previousSales] = await Promise.all([
    findReportSales({
      from: dateRange.from,
      to: dateRange.to,
      barberId: input.barberId,
      paymentMethod: input.paymentMethod,
    }),
    findReportBarbers(),
    previousRange
      ? findReportSales({
          from: previousRange.from,
          to: previousRange.to,
          barberId: input.barberId,
          paymentMethod: input.paymentMethod,
        })
      : Promise.resolve([]),
  ]);
  const barberTotals = new Map<string, { barberName: string; total: number; saleCount: number }>();
  const paymentTotals = new Map<PaymentMethod, number>(paymentMethods.map((method) => [method, 0]));
  const dayTotals = new Map<string, { total: number; saleCount: number }>();
  const branchTotals = new Map<string, { branchName: string; total: number; saleCount: number }>();
  const serviceTotals = new Map<string, { total: number; quantity: number }>();
  const weekdayTotals = [0, 0, 0, 0, 0, 0, 0];
  let itemsSold = 0;

  for (const sale of sales) {
    const saleTotal = input.paymentMethod
      ? sale.payments.reduce((total, payment) => total + payment.amount, 0)
      : sale.total;
    const currentBarberTotal = barberTotals.get(sale.barber.id) ?? {
      barberName: sale.barber.name,
      total: 0,
      saleCount: 0,
    };

    currentBarberTotal.total += saleTotal;
    currentBarberTotal.saleCount += 1;
    barberTotals.set(sale.barber.id, currentBarberTotal);

    const currentBranch = branchTotals.get(sale.branch.name) ?? { branchName: sale.branch.name, total: 0, saleCount: 0 };
    currentBranch.total += saleTotal;
    currentBranch.saleCount += 1;
    branchTotals.set(sale.branch.name, currentBranch);

    const dayKey = toLocalDayKey(sale.soldAt);
    const currentDayTotal = dayTotals.get(dayKey) ?? { total: 0, saleCount: 0 };
    currentDayTotal.total += saleTotal;
    currentDayTotal.saleCount += 1;
    dayTotals.set(dayKey, currentDayTotal);

    weekdayTotals[sale.soldAt.getDay()] += saleTotal;

    for (const item of sale.items) {
      const currentService = serviceTotals.get(item.description) ?? { total: 0, quantity: 0 };
      currentService.total += item.total;
      currentService.quantity += item.quantity;
      serviceTotals.set(item.description, currentService);
      itemsSold += item.quantity;
    }

    for (const payment of sale.payments) {
      paymentTotals.set(payment.method, (paymentTotals.get(payment.method) ?? 0) + payment.amount);
    }
  }

  const totalSold = sales.reduce(
    (total, sale) => total + (input.paymentMethod ? sale.payments.reduce((sum, payment) => sum + payment.amount, 0) : sale.total),
    0,
  );

  const comparison = previousRange
    ? (() => {
        const previousTotal = previousSales.reduce(
          (total, sale) => total + (input.paymentMethod ? sale.payments.reduce((sum, payment) => sum + payment.amount, 0) : sale.total),
          0,
        );

        return {
          previousTotal,
          deltaPct: previousTotal > 0 ? Math.round(((totalSold - previousTotal) / previousTotal) * 100) : null,
        };
      })()
    : null;

  return {
    from: dateRange.from,
    to: dateRange.to,
    totalSold,
    saleCount: sales.length,
    averageTicket: sales.length > 0 ? Math.round(totalSold / sales.length) : 0,
    itemsSold,
    comparison,
    salesByDay: Array.from(dayTotals.entries())
      .map(([date, totals]) => ({ date, total: totals.total, saleCount: totals.saleCount }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    salesByWeekday: weekdayTotals.map((total, weekday) => ({ weekday, total })),
    salesByBranch: Array.from(branchTotals.values()).sort((a, b) => b.total - a.total || a.branchName.localeCompare(b.branchName)),
    topServices: Array.from(serviceTotals.entries())
      .map(([name, totals]) => ({ name, total: totals.total, quantity: totals.quantity }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
      .slice(0, 6),
    filters: {
      barberId: input.barberId,
      paymentMethod: input.paymentMethod,
    },
    options: {
      barbers,
      paymentMethods,
    },
    totalsByBarber: Array.from(barberTotals.entries())
      .map(([barberId, total]) => ({
        barberId,
        barberName: total.barberName,
        total: total.total,
        saleCount: total.saleCount,
      }))
      .sort((a, b) => b.total - a.total || a.barberName.localeCompare(b.barberName)),
    totalsByPaymentMethod: Array.from(paymentTotals.entries()).map(([method, total]) => ({ method, total })),
    latestSales: sales.slice(0, 10).map((sale) => ({
      id: sale.id,
      soldAt: sale.soldAt,
      total: sale.total,
      branchName: sale.branch.name,
      barberName: sale.barber.name,
      items: sale.items,
      payments: sale.payments,
    })),
  };
}

function toLocalDayKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// Período inmediatamente anterior, de la misma duración, para comparar.
function buildPreviousRange(dateRange: { from?: Date; to?: Date }) {
  if (!dateRange.from || !dateRange.to) return null;

  const periodMs = dateRange.to.getTime() - dateRange.from.getTime();
  if (periodMs <= 0) return null;

  return {
    from: new Date(dateRange.from.getTime() - periodMs),
    to: new Date(dateRange.from.getTime() - 1),
  };
}

function resolveDateRange(input: SalesReportInput) {
  if (input.from || input.to) {
    return {
      from: input.from,
      to: input.to,
    };
  }

  return getServerLocalTodayBoundaries();
}

function getServerLocalTodayBoundaries() {
  const now = new Date();
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);

  const to = new Date(now);
  to.setHours(23, 59, 59, 999);

  return { from, to };
}
