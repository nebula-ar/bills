import { PaymentMethod, SaleStatus, StockMovementType, UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type SalesReportFilters = {
  from?: Date;
  to?: Date;
  staffId?: string;
  paymentMethod?: PaymentMethod;
};

export type TodaySalesReportSale = Awaited<ReturnType<typeof findReportSales>>[number];
export type ReportStaffOption = Awaited<ReturnType<typeof findReportStaffs>>[number];

export function findReportSales(businessId: string, filters: SalesReportFilters) {
  return prisma.sale.findMany({
    where: {
      deleted: false,
      status: SaleStatus.COMPLETED,
      soldAt: buildSoldAtFilter(filters),
      staffId: filters.staffId,
      payments: filters.paymentMethod
        ? {
            some: {
              deleted: false,
              method: filters.paymentMethod,
            },
          }
        : undefined,
      branch: {
        businessId,
        deleted: false,
      },
      staff: {
        deleted: false,
      },
    },
    orderBy: {
      soldAt: "desc",
    },
    select: {
      id: true,
      soldAt: true,
      total: true,
      branch: {
        select: {
          name: true,
        },
      },
      staff: {
        select: {
          id: true,
          name: true,
        },
      },
      items: {
        where: {
          deleted: false,
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          description: true,
          quantity: true,
          total: true,
          // Costo congelado al vender: es lo que hace que la ganancia sea la
          // de ese momento y no la que daría el costo de reposición de hoy.
          unitCost: true,
          // Para distinguir el renglón que le FALTA el costo del que no tiene
          // costo porque no puede tenerlo: un corte de pelo no tiene costo de
          // mercadería, lo que cuesta es el tiempo del empleado (y eso ya está
          // en sueldos y comisiones).
          product: { select: { trackStock: true } },
        },
      },
      payments: {
        where: {
          deleted: false,
          method: filters.paymentMethod,
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          method: true,
          amount: true,
        },
      },
    },
  });
}

// Total del período (para la comparación con el período anterior) SIN traer todas
// las ventas: lo resuelve la DB con aggregate/_sum. Antes se hacía un findMany
// completo (con items y pagos) del período anterior solo para sumar.
export async function sumReportSalesTotal(businessId: string, filters: SalesReportFilters): Promise<number> {
  const saleWhere = {
    deleted: false,
    status: SaleStatus.COMPLETED,
    soldAt: buildSoldAtFilter(filters),
    staffId: filters.staffId,
    branch: { businessId, deleted: false },
    staff: { deleted: false },
  };

  if (filters.paymentMethod) {
    // Con filtro por método, el total es la suma de los pagos de ese método.
    const aggregate = await prisma.salePayment.aggregate({
      where: { deleted: false, method: filters.paymentMethod, sale: saleWhere },
      _sum: { amount: true },
    });
    return aggregate._sum.amount ?? 0;
  }

  const aggregate = await prisma.sale.aggregate({ where: saleWhere, _sum: { total: true } });
  return aggregate._sum.total ?? 0;
}

// Devoluciones del período, con el costo de lo que volvió al stock. Se cuentan
// por `returnedAt` y no por la fecha de la venta: la plata se devuelve el día
// que el cliente vuelve, aunque haya comprado el mes pasado.
export function findReturnedItemsInRange(businessId: string, from?: Date, to?: Date) {
  return prisma.saleReturnItem.findMany({
    where: {
      saleReturn: {
        branch: { businessId, deleted: false },
        ...(from || to ? { returnedAt: { gte: from, lte: to } } : {}),
      },
    },
    select: {
      quantity: true,
      amount: true,
      saleItem: { select: { unitCost: true } },
    },
  });
}

// Plata inmovilizada en mercadería, sumando las sucursales. Es lo que la compra
// dejó en la góndola en vez de dejarlo en la caja. Se valúa al promedio
// ponderado de cada sucursal (ver costing.logic.ts).
export function findStockForValuation(businessId: string) {
  return prisma.product.findMany({
    where: { businessId, deleted: false, active: true, trackStock: true },
    select: {
      cost: true,
      stockLevels: { select: { quantity: true, avgCost: true } },
    },
  });
}

// Mercadería que se perdió: merma, rotura, vencimiento, robo, y los faltantes
// que aparecen al contar. Es pérdida del período — plata que se compró y nunca
// se va a vender. Antes bajaba el stock en silencio y el resultado no se
// enteraba, que es justo por donde se escapa un faltante sin que nadie lo note.
export function findInventoryLossesInRange(businessId: string, from?: Date, to?: Date) {
  return prisma.stockMovement.findMany({
    where: {
      branch: { businessId, deleted: false },
      type: { in: [StockMovementType.LOSS, StockMovementType.ADJUSTMENT] },
      quantity: { lt: 0 },
      ...(from || to ? { occurredAt: { gte: from, lte: to } } : {}),
    },
    select: { type: true, quantity: true, unitCost: true, reason: true, product: { select: { name: true } } },
  });
}

export function findReportStaffs(businessId: string) {
  return prisma.user.findMany({
    where: {
      businessId,
      deleted: false,
      active: true,
      role: UserRole.STAFF,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
    },
  });
}

export const paymentMethods = Object.values(PaymentMethod);

function buildSoldAtFilter(filters: SalesReportFilters) {
  if (!filters.from && !filters.to) {
    return undefined;
  }

  return {
    gte: filters.from,
    lte: filters.to,
  };
}
