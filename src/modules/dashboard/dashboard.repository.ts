import { PaymentMethod, SaleStatus, UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type DashboardSalesFilters = {
  from: Date;
};

export function findDashboardBusiness() {
  return prisma.business.findFirst({
    where: {
      deleted: false,
    },
    select: {
      name: true,
    },
  });
}

export function findDashboardSales(filters: DashboardSalesFilters) {
  return prisma.sale.findMany({
    where: {
      deleted: false,
      status: SaleStatus.COMPLETED,
      soldAt: {
        gte: filters.from,
      },
      branch: {
        deleted: false,
        active: true,
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
          id: true,
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
        select: {
          id: true,
          description: true,
          quantity: true,
          total: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      payments: {
        where: {
          deleted: false,
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

export function countDashboardCancelledSales(filters: DashboardSalesFilters) {
  return prisma.sale.count({
    where: {
      deleted: false,
      status: SaleStatus.CANCELLED,
      soldAt: {
        gte: filters.from,
      },
      branch: {
        deleted: false,
        active: true,
      },
      barber: {
        deleted: false,
      },
    },
  });
}

export function countDashboardBarbers() {
  return prisma.user.count({
    where: {
      deleted: false,
      active: true,
      role: UserRole.BARBER,
    },
  });
}

export function findDashboardServicePrices() {
  return prisma.branchServicePrice.findMany({
    where: {
      deleted: false,
      active: true,
      branch: {
        deleted: false,
        active: true,
      },
      service: {
        deleted: false,
        active: true,
      },
    },
    select: {
      id: true,
      price: true,
      branch: {
        select: {
          id: true,
          name: true,
        },
      },
      service: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [
      { branch: { name: "asc" } },
      { service: { name: "asc" } },
    ],
  });
}

export const dashboardPaymentMethods = Object.values(PaymentMethod);
