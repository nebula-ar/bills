import { prisma } from "@/lib/prisma";

export type CreateGlobalServiceRepositoryInput = {
  businessId: string;
  name: string;
  description?: string;
};

export type CreateBranchServiceRepositoryInput = {
  branchId: string;
  businessId: string;
  name: string;
  description?: string;
  price: number;
};

export type UpdateBranchServiceRepositoryInput = {
  servicePriceId: string;
  price: number;
  active: boolean;
};

export type UpsertBranchServiceConfigRepositoryInput = {
  branchId: string;
  serviceId: string;
  price: number;
  active: boolean;
};

export type BranchServiceConfiguration = Awaited<ReturnType<typeof findServiceManagementData>>;

export async function findServiceManagementData(selectedBranchId?: string) {
  const branches = await prisma.branch.findMany({
    where: {
      deleted: false,
      active: true,
      business: {
        deleted: false,
      },
    },
    select: {
      id: true,
      name: true,
      businessId: true,
      business: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  const selectedBranch = selectedBranchId
    ? branches.find((branch) => branch.id === selectedBranchId) ?? branches[0]
    : branches[0];

  if (!selectedBranch) {
    return {
      branches,
      selectedBranch: null,
      services: [],
    };
  }

  const services = await prisma.service.findMany({
    where: {
      businessId: selectedBranch.businessId,
      deleted: false,
    },
    select: {
      id: true,
      name: true,
      description: true,
      active: true,
      branchPrices: {
        where: {
          deleted: false,
          branch: {
            deleted: false,
          },
        },
        select: {
          id: true,
          branchId: true,
          price: true,
          active: true,
        },
        orderBy: [
          { active: "desc" },
          { createdAt: "asc" },
          { id: "asc" },
        ],
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  return {
    branches,
    selectedBranch,
    services: services.map((service) => {
      const branchPrice = service.branchPrices.find((price) => price.branchId === selectedBranch.id) ?? null;
      const suggestedPrice = service.branchPrices.find((price) => price.branchId !== selectedBranch.id)?.price ?? null;

      return {
        id: service.id,
        name: service.name,
        description: service.description,
        active: service.active,
        configured: branchPrice !== null,
        suggestedPrice,
        branchPrice: branchPrice
          ? {
              id: branchPrice.id,
              price: branchPrice.price,
              active: branchPrice.active,
            }
          : null,
      };
    }),
  };
}

export function findServiceManagementBranchById(branchId: string) {
  return prisma.branch.findFirst({
    where: {
      id: branchId,
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

export function findServiceManagementServiceById(serviceId: string) {
  return prisma.service.findFirst({
    where: {
      id: serviceId,
      deleted: false,
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

export function createGlobalService(input: CreateGlobalServiceRepositoryInput) {
  return prisma.service.create({
    data: {
      businessId: input.businessId,
      name: input.name,
      description: input.description,
      active: true,
    },
  });
}

export function findBranchServicePriceForUpdate(branchId: string, servicePriceId: string) {
  return prisma.branchServicePrice.findFirst({
    where: {
      id: servicePriceId,
      branchId,
      deleted: false,
      service: {
        deleted: false,
      },
      branch: {
        deleted: false,
        active: true,
        business: {
          deleted: false,
        },
      },
    },
    select: {
      id: true,
    },
  });
}

export function createBranchServiceTransaction(input: CreateBranchServiceRepositoryInput) {
  return prisma.$transaction(async (tx) => {
    const service = await tx.service.create({
      data: {
        businessId: input.businessId,
        name: input.name,
        description: input.description,
        active: true,
      },
    });

    return tx.branchServicePrice.create({
      data: {
        branchId: input.branchId,
        serviceId: service.id,
        price: input.price,
        active: true,
      },
      include: {
        service: true,
      },
    });
  });
}

export function updateBranchServicePrice(input: UpdateBranchServiceRepositoryInput) {
  return prisma.branchServicePrice.update({
    where: {
      id: input.servicePriceId,
    },
    data: {
      price: input.price,
      active: input.active,
    },
  });
}

export function upsertBranchServiceConfig(input: UpsertBranchServiceConfigRepositoryInput) {
  return prisma.branchServicePrice.upsert({
    where: {
      branchId_serviceId: {
        branchId: input.branchId,
        serviceId: input.serviceId,
      },
    },
    create: {
      branchId: input.branchId,
      serviceId: input.serviceId,
      price: input.price,
      active: input.active,
    },
    update: {
      price: input.price,
      active: input.active,
      deleted: false,
      deletedAt: null,
      deletedById: null,
    },
  });
}
