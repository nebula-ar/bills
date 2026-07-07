import { UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export function findActiveBarberForPinValidation(barberId: string, branchId?: string) {
  return prisma.user.findFirst({
    where: {
      id: barberId,
      branchId,
      active: true,
      deleted: false,
      role: UserRole.BARBER,
      branch: branchId
        ? {
            id: branchId,
            active: true,
            deleted: false,
          }
        : undefined,
      business: {
        deleted: false,
      },
    },
    select: {
      id: true,
      pinHash: true,
    },
  });
}

export function findActiveBarbersForManagement(businessId: string) {
  return prisma.user.findMany({
    where: {
      businessId,
      deleted: false,
      role: UserRole.BARBER,
      business: {
        deleted: false,
      },
      branch: {
        deleted: false,
      },
    },
    orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      active: true,
      branchId: true,
      pinHash: true,
      branch: {
        select: {
          id: true,
          name: true,
          business: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });
}

export function findBranchesForBarberManagement(businessId: string) {
  return prisma.branch.findMany({
    where: {
      businessId,
      deleted: false,
      active: true,
      business: {
        deleted: false,
      },
    },
    orderBy: [{ business: { name: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      businessId: true,
      business: {
        select: {
          name: true,
        },
      },
    },
  });
}

export function findBarberManagementBranchById(branchId: string, businessId: string) {
  return prisma.branch.findFirst({
    where: {
      id: branchId,
      businessId,
      deleted: false,
      active: true,
      business: {
        deleted: false,
      },
    },
    select: {
      id: true,
      businessId: true,
    },
  });
}

export type CreateBarberRepositoryInput = {
  name: string;
  branchId: string;
  businessId: string;
  pinHash: string;
};

export function createBarber(input: CreateBarberRepositoryInput) {
  return prisma.user.create({
    data: {
      name: input.name,
      branchId: input.branchId,
      businessId: input.businessId,
      pinHash: input.pinHash,
      role: UserRole.BARBER,
      active: true,
    },
  });
}

export type UpdateBarberRepositoryInput = {
  barberId: string;
  name: string;
  branchId: string;
  businessId: string;
  active: boolean;
  pinHash?: string;
};

export function updateBarber(input: UpdateBarberRepositoryInput) {
  return prisma.user.updateMany({
    where: {
      id: input.barberId,
      businessId: input.businessId,
      deleted: false,
      role: UserRole.BARBER,
    },
    data: {
      name: input.name,
      branchId: input.branchId,
      businessId: input.businessId,
      active: input.active,
      ...(input.pinHash ? { pinHash: input.pinHash } : {}),
    },
  });
}

export function updateBarberPinHash(barberId: string, pinHash: string) {
  return prisma.user.updateMany({
    where: {
      id: barberId,
      active: true,
      deleted: false,
      role: UserRole.BARBER,
    },
    data: {
      pinHash,
    },
  });
}
