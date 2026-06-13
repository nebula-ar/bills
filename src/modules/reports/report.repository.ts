import { PaymentMethod, SaleStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type TodaySalesReportSale = Awaited<ReturnType<typeof findTodayReportSales>>[number];

export function findTodayReportSales(startOfDay: Date, startOfNextDay: Date) {
  return prisma.sale.findMany({
    where: {
      deleted: false,
      status: SaleStatus.COMPLETED,
      soldAt: {
        gte: startOfDay,
        lt: startOfNextDay,
      },
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

export const paymentMethods = Object.values(PaymentMethod);
