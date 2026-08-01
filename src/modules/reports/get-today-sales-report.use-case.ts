import type { PaymentMethod } from "@/generated/prisma/client";

import { findReportStaffs, findReportSales, paymentMethods, sumReportSalesTotal } from "./report.repository";
import { lineTotal, QUANTITY_SCALE } from "@/lib/quantity";

export type SalesReportInput = {
  businessId: string;
  from?: Date;
  to?: Date;
  staffId?: string;
  paymentMethod?: PaymentMethod;
};

export type TodaySalesReport = {
  from?: Date;
  to?: Date;
  totalSold: number;
  // Lo facturado, siempre a partir del total de cada venta. `totalSold` cambia
  // de significado cuando se filtra por cuenta (pasa a ser la suma de los pagos
  // de esa cuenta) y con eso no se puede calcular una ganancia.
  revenue: number;
  // Costo congelado de todo lo vendido en el período.
  soldCost: number;
  // Lo que se vendió sin costo cargado. Mientras haya algo acá, la ganancia
  // está inflada y hay que decirlo en vez de disimularlo.
  itemsWithoutCost: { name: string; quantity: number }[];
  saleCount: number;
  averageTicket: number;
  // En unidades enteras equivalentes: el detalle en milésimas lo guardan los
  // renglones (`topProducts`), acá interesa el volumen del período.
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
  topProducts: {
    name: string;
    total: number;
    quantity: number;
  }[];
  filters: {
    staffId?: string;
    paymentMethod?: PaymentMethod;
  };
  options: {
    staffs: {
      id: string;
      name: string;
    }[];
    paymentMethods: PaymentMethod[];
  };
  totalsByStaff: {
    staffId: string;
    staffName: string;
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
    staffName: string;
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

export async function getTodaySalesReport(input: SalesReportInput): Promise<TodaySalesReport> {
  const dateRange = resolveDateRange(input);
  const previousRange = buildPreviousRange(dateRange);
  const [sales, staffs, previousTotal] = await Promise.all([
    findReportSales(input.businessId, {
      from: dateRange.from,
      to: dateRange.to,
      staffId: input.staffId,
      paymentMethod: input.paymentMethod,
    }),
    findReportStaffs(input.businessId),
    previousRange
      ? sumReportSalesTotal(input.businessId, {
          from: previousRange.from,
          to: previousRange.to,
          staffId: input.staffId,
          paymentMethod: input.paymentMethod,
        })
      : Promise.resolve(0),
  ]);
  const staffTotals = new Map<string, { staffName: string; total: number; saleCount: number }>();
  const paymentTotals = new Map<PaymentMethod, number>(paymentMethods.map((method) => [method, 0]));
  const dayTotals = new Map<string, { total: number; saleCount: number }>();
  const branchTotals = new Map<string, { branchName: string; total: number; saleCount: number }>();
  const productTotals = new Map<string, { total: number; quantity: number }>();
  const weekdayTotals = [0, 0, 0, 0, 0, 0, 0];
  const withoutCost = new Map<string, number>();
  let itemsSold = 0;
  let soldCost = 0;

  for (const sale of sales) {
    const saleTotal = input.paymentMethod
      ? sale.payments.reduce((total, payment) => total + payment.amount, 0)
      : sale.total;
    const currentStaffTotal = staffTotals.get(sale.staff.id) ?? {
      staffName: sale.staff.name,
      total: 0,
      saleCount: 0,
    };

    currentStaffTotal.total += saleTotal;
    currentStaffTotal.saleCount += 1;
    staffTotals.set(sale.staff.id, currentStaffTotal);

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
      const currentProduct = productTotals.get(item.description) ?? { total: 0, quantity: 0 };
      currentProduct.total += item.total;
      currentProduct.quantity += item.quantity;
      productTotals.set(item.description, currentProduct);
      itemsSold += item.quantity;

      // Sin costo cargado no se inventa uno: se suma cero y se anota el
      // producto, porque una ganancia inflada en silencio es peor que no tenerla.
      //
      // Pero solo cuenta como faltante la mercadería. Un servicio —un corte, una
      // instalación— no tiene costo de mercadería y nunca lo va a tener: avisar
      // por eso dejaría a una barbería con el cartel de "ganancia inflada"
      // puesto para siempre, y un aviso que está siempre no lo lee nadie.
      if (item.unitCost) {
        soldCost += lineTotal(item.unitCost, item.quantity);
      } else if (item.product?.trackStock) {
        withoutCost.set(item.description, (withoutCost.get(item.description) ?? 0) + item.quantity);
      }
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
    ? {
        previousTotal,
        deltaPct: previousTotal > 0 ? Math.round(((totalSold - previousTotal) / previousTotal) * 100) : null,
      }
    : null;

  return {
    from: dateRange.from,
    to: dateRange.to,
    totalSold,
    revenue: sales.reduce((total, sale) => total + sale.total, 0),
    soldCost,
    itemsWithoutCost: Array.from(withoutCost.entries())
      .map(([name, quantity]) => ({ name, quantity: Math.round(quantity / QUANTITY_SCALE) }))
      .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name)),
    saleCount: sales.length,
    averageTicket: sales.length > 0 ? Math.round(totalSold / sales.length) : 0,
    // Las cantidades viven en milésimas (ver src/lib/quantity.ts): sin dividir,
    // "10 ítems vendidos" se mostraría como 10.000.
    itemsSold: Math.round(itemsSold / QUANTITY_SCALE),
    comparison,
    salesByDay: Array.from(dayTotals.entries())
      .map(([date, totals]) => ({ date, total: totals.total, saleCount: totals.saleCount }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    salesByWeekday: weekdayTotals.map((total, weekday) => ({ weekday, total })),
    salesByBranch: Array.from(branchTotals.values()).sort((a, b) => b.total - a.total || a.branchName.localeCompare(b.branchName)),
    topProducts: Array.from(productTotals.entries())
      .map(([name, totals]) => ({ name, total: totals.total, quantity: totals.quantity }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
      .slice(0, 6),
    filters: {
      staffId: input.staffId,
      paymentMethod: input.paymentMethod,
    },
    options: {
      staffs,
      paymentMethods,
    },
    totalsByStaff: Array.from(staffTotals.entries())
      .map(([staffId, total]) => ({
        staffId,
        staffName: total.staffName,
        total: total.total,
        saleCount: total.saleCount,
      }))
      .sort((a, b) => b.total - a.total || a.staffName.localeCompare(b.staffName)),
    totalsByPaymentMethod: Array.from(paymentTotals.entries()).map(([method, total]) => ({ method, total })),
    latestSales: sales.slice(0, 10).map((sale) => ({
      id: sale.id,
      soldAt: sale.soldAt,
      total: sale.total,
      branchName: sale.branch.name,
      staffName: sale.staff.name,
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
