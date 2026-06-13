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

export function findReportSales(filters: SalesReportFilters) {
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

export function findReportBarbers() {
  return prisma.user.findMany({
    where: {
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
