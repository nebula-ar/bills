import type { PaymentMethod } from "@/generated/prisma/client";

import { findTodayReportSales, paymentMethods } from "./report.repository";

export type TodaySalesReport = {
  startOfDay: Date;
  startOfNextDay: Date;
  totalSold: number;
  saleCount: number;
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

export async function getTodaySalesReport(): Promise<TodaySalesReport> {
  const { startOfDay, startOfNextDay } = getServerLocalTodayBoundaries();
  const sales = await findTodayReportSales(startOfDay, startOfNextDay);
  const barberTotals = new Map<string, { barberName: string; total: number; saleCount: number }>();
  const paymentTotals = new Map<PaymentMethod, number>(paymentMethods.map((method) => [method, 0]));

  for (const sale of sales) {
    const currentBarberTotal = barberTotals.get(sale.barber.id) ?? {
      barberName: sale.barber.name,
      total: 0,
      saleCount: 0,
    };

    currentBarberTotal.total += sale.total;
    currentBarberTotal.saleCount += 1;
    barberTotals.set(sale.barber.id, currentBarberTotal);

    for (const payment of sale.payments) {
      paymentTotals.set(payment.method, (paymentTotals.get(payment.method) ?? 0) + payment.amount);
    }
  }

  return {
    startOfDay,
    startOfNextDay,
    totalSold: sales.reduce((total, sale) => total + sale.total, 0),
    saleCount: sales.length,
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

function getServerLocalTodayBoundaries() {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const startOfNextDay = new Date(startOfDay);
  startOfNextDay.setDate(startOfNextDay.getDate() + 1);

  return { startOfDay, startOfNextDay };
}
