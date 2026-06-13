import { prisma } from "@/lib/prisma";

export type CreateBranchRepositoryInput = {
  businessId: string;
  name: string;
  address?: string;
};

export type UpdateBranchRepositoryInput = {
  branchId: string;
  name: string;
  address?: string;
  active: boolean;
};

export function findBranchesForManagement() {
  return prisma.branch.findMany({
    where: {
      deleted: false,
      business: {
        deleted: false,
      },
    },
    orderBy: [{ business: { name: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      address: true,
      active: true,
      business: {
        select: {
          name: true,
        },
      },
    },
  });
}

export function findManagementBusiness() {
  return prisma.business.findFirst({
    where: {
      deleted: false,
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
    },
  });
}

export function createBranch(input: CreateBranchRepositoryInput) {
  return prisma.branch.create({
    data: {
      businessId: input.businessId,
      name: input.name,
      address: input.address,
      active: true,
    },
  });
}

export function updateBranch(input: UpdateBranchRepositoryInput) {
  return prisma.branch.updateMany({
    where: {
      id: input.branchId,
      deleted: false,
      business: {
        deleted: false,
      },
    },
    data: {
      name: input.name,
      address: input.address,
      active: input.active,
    },
  });
}
