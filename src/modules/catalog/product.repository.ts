import type { ProductKind, Unit } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type CreateGlobalProductRepositoryInput = {
  businessId: string;
  name: string;
  description?: string;
};

export type CreateBranchProductRepositoryInput = {
  branchId: string;
  businessId: string;
  name: string;
  description?: string;
  price: number;
};

export type UpdateBranchProductRepositoryInput = {
  productPriceId: string;
  price: number;
  active: boolean;
};

export type UpsertBranchProductConfigRepositoryInput = {
  branchId: string;
  productId: string;
  price: number;
  active: boolean;
};

export type BranchProductConfiguration = Awaited<ReturnType<typeof findProductManagementData>>;

export async function findProductManagementData(businessId: string, selectedBranchId?: string) {
  const branches = await prisma.branch.findMany({
    where: {
      businessId,
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
      categories: [] as { id: string; name: string }[],
      products: [],
    };
  }

  const products = await prisma.product.findMany({
    where: {
      businessId: selectedBranch.businessId,
      deleted: false,
    },
    select: {
      id: true,
      name: true,
      description: true,
      active: true,
      kind: true,
      unit: true,
      sku: true,
      barcode: true,
      cost: true,
      trackStock: true,
      minStock: true,
      packSize: true,
      packLabel: true,
      categoryId: true,
      imageUpdatedAt: true,
      familyId: true,
      variantLabel: true,
      family: { select: { id: true, name: true } },
      // Existencia en la sucursal elegida: se muestra en la lista y en la
      // ficha, para no tener que ir a otra pantalla a preguntarla.
      stockLevels: { where: { branchId: selectedBranch.id }, select: { quantity: true } },
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

  const categories = await prisma.productCategory.findMany({
    where: { businessId: selectedBranch.businessId, deleted: false },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return {
    branches,
    selectedBranch,
    categories,
    products: products.map((product) => {
      const branchPrice = product.branchPrices.find((price) => price.branchId === selectedBranch.id) ?? null;
      const suggestedPrice = product.branchPrices.find((price) => price.branchId !== selectedBranch.id)?.price ?? null;

      return {
        id: product.id,
        name: product.name,
        description: product.description,
        active: product.active,
        kind: product.kind,
        unit: product.unit,
        sku: product.sku,
        barcode: product.barcode,
        cost: product.cost,
        trackStock: product.trackStock,
        minStock: product.minStock,
        packSize: product.packSize,
        packLabel: product.packLabel,
        categoryId: product.categoryId,
        imageUpdatedAt: product.imageUpdatedAt,
        familyId: product.familyId,
        familyName: product.family?.name ?? null,
        variantLabel: product.variantLabel,
        // null = el producto no lleva control de stock.
        stockQuantity: product.trackStock ? product.stockLevels[0]?.quantity ?? 0 : null,
        configured: branchPrice !== null,
        suggestedPrice,
        branchPrice: branchPrice
          ? {
              id: branchPrice.id,
              price: branchPrice.price,
              active: branchPrice.active,
            }
          : null,
        branchPrices: product.branchPrices.map((price) => ({
          branchId: price.branchId,
          price: price.price,
          active: price.active,
        })),
      };
    }),
  };
}

export function findProductManagementBranchById(branchId: string, businessId: string) {
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

export function findProductManagementProductById(productId: string, businessId: string) {
  return prisma.product.findFirst({
    where: {
      id: productId,
      businessId,
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

export function createGlobalProduct(input: CreateGlobalProductRepositoryInput) {
  return prisma.product.create({
    data: {
      businessId: input.businessId,
      name: input.name,
      description: input.description,
      active: true,
    },
  });
}

export type UpdateProductDetailsInput = {
  productId: string;
  name: string;
  description?: string;
  kind?: ProductKind;
  unit?: Unit;
  sku?: string | null;
  barcode?: string | null;
  cost?: number | null;
  trackStock?: boolean;
  minStock?: number | null;
  packSize?: number | null;
  packLabel?: string | null;
  categoryId?: string | null;
};

// Los campos comerciales son `undefined` cuando el formulario no los mandó
// (pantallas viejas o rubros que no los usan): en ese caso no se tocan.
export function updateProductDetails(input: UpdateProductDetailsInput) {
  return prisma.product.update({
    where: { id: input.productId },
    data: {
      name: input.name,
      description: input.description ?? null,
      ...(input.kind !== undefined ? { kind: input.kind } : {}),
      ...(input.unit !== undefined ? { unit: input.unit } : {}),
      ...(input.sku !== undefined ? { sku: input.sku } : {}),
      ...(input.barcode !== undefined ? { barcode: input.barcode } : {}),
      ...(input.cost !== undefined ? { cost: input.cost } : {}),
      ...(input.trackStock !== undefined ? { trackStock: input.trackStock } : {}),
      ...(input.minStock !== undefined ? { minStock: input.minStock } : {}),
      ...(input.packSize !== undefined ? { packSize: input.packSize } : {}),
      ...(input.packLabel !== undefined ? { packLabel: input.packLabel } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
    },
  });
}

export function findBranchProductPriceForUpdate(branchId: string, productPriceId: string) {
  return prisma.branchProductPrice.findFirst({
    where: {
      id: productPriceId,
      branchId,
      deleted: false,
      product: {
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

export function createBranchProductTransaction(input: CreateBranchProductRepositoryInput) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        businessId: input.businessId,
        name: input.name,
        description: input.description,
        active: true,
      },
    });

    return tx.branchProductPrice.create({
      data: {
        branchId: input.branchId,
        productId: product.id,
        price: input.price,
        active: true,
      },
      include: {
        product: true,
      },
    });
  });
}

export function updateBranchProductPrice(input: UpdateBranchProductRepositoryInput) {
  return prisma.branchProductPrice.update({
    where: {
      id: input.productPriceId,
    },
    data: {
      price: input.price,
      active: input.active,
    },
  });
}

export function upsertBranchProductConfig(input: UpsertBranchProductConfigRepositoryInput) {
  return prisma.branchProductPrice.upsert({
    where: {
      branchId_productId: {
        branchId: input.branchId,
        productId: input.productId,
      },
    },
    create: {
      branchId: input.branchId,
      productId: input.productId,
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

// Catálogo plano para armar promociones: productos y categorías del negocio.
export async function findCatalogForPromotions(businessId: string) {
  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: { businessId, deleted: false, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.productCategory.findMany({
      where: { businessId, deleted: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return { products, categories };
}

// Cuántos productos tiene cargados el negocio. Con cero, la app todavía no
// puede vender nada: el panel lo avisa y el catálogo abre su onboarding.
export function countActiveProducts(businessId: string) {
  return prisma.product.count({ where: { businessId, deleted: false } });
}
