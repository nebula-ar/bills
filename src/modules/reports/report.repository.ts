import { PaymentMethod, SaleStatus, UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type SalesReportFilters = {
  from?: Date;
  to?: Date;
  barberId?: string;
  paymentMethod?: PaymentMethod;
};

export type TodaySalesReportSale = Awaited<ReturnType<typeof findReportSales>>[number];
export type ReportBarberOption = Awaited<ReturnType<typeof findReportBarbers>>[number];

export function findReportSales(businessId: string, filters: SalesReportFilters) {
  return prisma.sale.findMany({
    where: {
      deleted: false,
      status: SaleStatus.COMPLETED,
      soldAt: buildSoldAtFilter(filters),
      barberId: filters.barberId,
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
      barber: {
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
      barber: {
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
    barberId: filters.barberId,
    branch: { businessId, deleted: false },
    barber: { deleted: false },
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

export function findReportBarbers(businessId: string) {
  return prisma.user.findMany({
    where: {
      businessId,
      deleted: false,
      active: true,
      role: UserRole.BARBER,
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
