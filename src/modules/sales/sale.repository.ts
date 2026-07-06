import { prisma } from "@/lib/prisma";
import { SaleStatus, UserRole } from "@/generated/prisma/client";

import type { CreateSalePaymentDto } from "./create-sale.dto";

export type CreateSaleRepositoryItem = {
  serviceId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type CreateSaleRepositoryInput = {
  branchId: string;
  barberId: string;
  total: number;
  items: CreateSaleRepositoryItem[];
  payments: CreateSalePaymentDto[];
  notes?: string;
  soldAt?: Date;
};

export type CancelSaleRepositoryInput = {
  saleId: string;
  notes?: string;
};

export function findSaleBranch(branchId: string) {
  return prisma.branch.findFirst({
    where: {
      id: branchId,
      active: true,
      deleted: false,
    },
  });
}

export function findSaleBarber(barberId: string) {
  return prisma.user.findUnique({
    where: {
      id: barberId,
    },
  });
}

export function findBranchServicePrices(branchId: string, serviceIds: string[]) {
  return prisma.branchServicePrice.findMany({
    where: {
      branchId,
      serviceId: {
        in: serviceIds,
      },
      active: true,
      deleted: false,
      service: {
        active: true,
        deleted: false,
      },
    },
    include: {
      service: true,
    },
  });
}

export function findSaleEntryOptionsBranch(branchId?: string) {
  return prisma.branch.findFirst({
    where: {
      ...(branchId ? { id: branchId } : {}),
      deleted: false,
      active: true,
      business: {
        deleted: false,
      },
      users: {
        some: {
          deleted: false,
          active: true,
          role: UserRole.BARBER,
        },
      },
      servicePrices: {
        some: {
          deleted: false,
          active: true,
          service: {
            deleted: false,
            active: true,
          },
        },
      },
    },
    include: {
      business: {
        select: {
          name: true,
        },
      },
      users: {
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
      },
      servicePrices: {
        where: {
          deleted: false,
          active: true,
          service: {
            deleted: false,
            active: true,
          },
        },
        include: {
          service: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          service: {
            name: "asc",
          },
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });
}

// Todas las sucursales activas con barberos y servicios, para el checkout del POS.
export function findSaleEntryBranches() {
  return prisma.branch.findMany({
    where: {
      deleted: false,
      active: true,
      business: {
        deleted: false,
      },
      users: {
        some: {
          deleted: false,
          active: true,
          role: UserRole.BARBER,
        },
      },
      servicePrices: {
        some: {
          deleted: false,
          active: true,
          service: {
            deleted: false,
            active: true,
          },
        },
      },
    },
    include: {
      business: {
        select: {
          name: true,
        },
      },
      users: {
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
      },
      servicePrices: {
        where: {
          deleted: false,
          active: true,
          service: {
            deleted: false,
            active: true,
          },
        },
        include: {
          service: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          service: {
            name: "asc",
          },
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });
}

export function findRecentSales(limit = 10) {
  return prisma.sale.findMany({
    where: {
      deleted: false,
      branch: {
        deleted: false,
        active: true,
      },
      barber: {
        deleted: false,
      },
    },
    take: limit,
    orderBy: {
      soldAt: "desc",
    },
    select: {
      id: true,
      soldAt: true,
      total: true,
      status: true,
      notes: true,
      branch: {
        select: {
          name: true,
        },
      },
      barber: {
        select: {
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

export function findBarberSalesInRange(input: { branchId: string; barberId: string; start: Date; end: Date }) {
  return prisma.sale.findMany({
    where: {
      deleted: false,
      branchId: input.branchId,
      barberId: input.barberId,
      soldAt: {
        gte: input.start,
        lt: input.end,
      },
    },
    orderBy: {
      soldAt: "desc",
    },
    select: {
      id: true,
      soldAt: true,
      total: true,
      status: true,
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
        },
      },
      payments: {
        where: {
          deleted: false,
        },
        select: {
          id: true,
          method: true,
        },
      },
    },
  });
}

export function findSaleForCancellation(saleId: string) {
  return prisma.sale.findFirst({
    where: {
      id: saleId,
      deleted: false,
    },
    select: {
      id: true,
      status: true,
      notes: true,
    },
  });
}

export function cancelSaleById(input: CancelSaleRepositoryInput) {
  return prisma.sale.update({
    where: {
      id: input.saleId,
    },
    data: {
      status: SaleStatus.CANCELLED,
      notes: input.notes,
    },
  });
}

export function createSaleTransaction(input: CreateSaleRepositoryInput) {
  return prisma.$transaction((tx) =>
    tx.sale.create({
      data: {
        branchId: input.branchId,
        barberId: input.barberId,
        total: input.total,
        notes: input.notes,
        soldAt: input.soldAt,
        items: {
          create: input.items.map((item) => ({
            serviceId: item.serviceId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
          })),
        },
        payments: {
          create: input.payments.map((payment) => ({
            method: payment.method,
            amount: payment.amount,
          })),
        },
      },
      include: {
        items: true,
        payments: true,
      },
    }),
  );
}
