import { UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export function findActiveStaffForPinValidation(staffId: string, branchId?: string) {
  return prisma.user.findFirst({
    where: {
      id: staffId,
      branchId,
      active: true,
      deleted: false,
      role: UserRole.STAFF,
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

export function findActiveStaffsForManagement(businessId: string) {
  return prisma.user.findMany({
    where: {
      businessId,
      deleted: false,
      role: UserRole.STAFF,
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
      canCloseCash: true,
      commissionRate: true,
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

export function findBranchesForStaffManagement(businessId: string) {
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

export function findStaffManagementBranchById(branchId: string, businessId: string) {
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

export type CreateStaffRepositoryInput = {
  name: string;
  branchId: string;
  businessId: string;
  pinHash: string;
  canCloseCash: boolean;
  commissionRate?: number;
};

export function createStaff(input: CreateStaffRepositoryInput) {
  return prisma.user.create({
    data: {
      name: input.name,
      branchId: input.branchId,
      businessId: input.businessId,
      pinHash: input.pinHash,
      canCloseCash: input.canCloseCash,
      ...(input.commissionRate !== undefined ? { commissionRate: input.commissionRate } : {}),
      role: UserRole.STAFF,
      active: true,
    },
  });
}

export type UpdateStaffRepositoryInput = {
  staffId: string;
  name: string;
  branchId: string;
  businessId: string;
  active: boolean;
  canCloseCash: boolean;
  commissionRate?: number;
  pinHash?: string;
};

export function updateStaff(input: UpdateStaffRepositoryInput) {
  return prisma.user.updateMany({
    where: {
      id: input.staffId,
      businessId: input.businessId,
      deleted: false,
      role: UserRole.STAFF,
    },
    data: {
      name: input.name,
      branchId: input.branchId,
      businessId: input.businessId,
      active: input.active,
      canCloseCash: input.canCloseCash,
      ...(input.commissionRate !== undefined ? { commissionRate: input.commissionRate } : {}),
      ...(input.pinHash ? { pinHash: input.pinHash } : {}),
    },
  });
}

export function updateStaffPinHash(staffId: string, pinHash: string) {
  return prisma.user.updateMany({
    where: {
      id: staffId,
      active: true,
      deleted: false,
      role: UserRole.STAFF,
    },
    data: {
      pinHash,
    },
  });
}
