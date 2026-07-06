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
  salesByDay: {
    date: string;
    total: number;
    saleCount: number;
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
  const [sales, barbers] = await Promise.all([
    findReportSales({
      from: dateRange.from,
      to: dateRange.to,
      barberId: input.barberId,
      paymentMethod: input.paymentMethod,
    }),
    findReportBarbers(),
  ]);
  const barberTotals = new Map<string, { barberName: string; total: number; saleCount: number }>();
  const paymentTotals = new Map<PaymentMethod, number>(paymentMethods.map((method) => [method, 0]));
  const dayTotals = new Map<string, { total: number; saleCount: number }>();

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

    const dayKey = toLocalDayKey(sale.soldAt);
    const currentDayTotal = dayTotals.get(dayKey) ?? { total: 0, saleCount: 0 };
    currentDayTotal.total += saleTotal;
    currentDayTotal.saleCount += 1;
    dayTotals.set(dayKey, currentDayTotal);

    for (const payment of sale.payments) {
      paymentTotals.set(payment.method, (paymentTotals.get(payment.method) ?? 0) + payment.amount);
    }
  }

  const totalSold = sales.reduce(
    (total, sale) => total + (input.paymentMethod ? sale.payments.reduce((sum, payment) => sum + payment.amount, 0) : sale.total),
    0,
  );

  return {
    from: dateRange.from,
    to: dateRange.to,
    totalSold,
    saleCount: sales.length,
    averageTicket: sales.length > 0 ? Math.round(totalSold / sales.length) : 0,
    salesByDay: Array.from(dayTotals.entries())
      .map(([date, totals]) => ({ date, total: totals.total, saleCount: totals.saleCount }))
      .sort((a, b) => a.date.localeCompare(b.date)),
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
