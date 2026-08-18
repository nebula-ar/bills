import { prisma } from "@/lib/prisma";

export type CreateBranchRepositoryInput = {
  businessId: string;
  name: string;
  address?: string;
};

export type UpdateBranchRepositoryInput = {
  branchId: string;
  businessId: string;
  name: string;
  address?: string;
  active: boolean;
};

export function findBranchesForManagement(businessId: string) {
  return prisma.branch.findMany({
    where: {
      businessId,
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

// `findManagementBusiness()` vivía acá y se borró a propósito: devolvía el
// PRIMER negocio de toda la base, sin mirar la sesión. No lo llamaba nadie, y
// esa era justamente la razón para sacarlo — quedaba a un import de distancia
// de que alguien lo usara para "resolver el negocio actual" y le sirviera a un
// cliente los datos de otro. El negocio actual sale de la sesión, siempre:
// `requireBusinessContext()` en src/lib/business-context.ts.

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
      businessId: input.businessId,
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
