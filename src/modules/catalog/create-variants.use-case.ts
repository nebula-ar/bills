import { ProductKind, StockMovementType, Unit } from "@/generated/prisma/client";
import { logEvent } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { applyStockMovement } from "@/modules/stock/stock.repository";

import { ProductError, ProductErrorCode } from "./product.errors";
import { generateVariants, type VariantAxis } from "./variants.logic";

// Tope de seguridad: 4 ejes de 6 valores ya son 1.296 productos. Nadie quiere
// crear eso por error y después borrarlos de a uno.
const MAX_VARIANTS = 100;

export type CreateVariantsInput = {
  businessId: string;
  branchId: string;
  modelName: string;
  axes: VariantAxis[];
  price: number;
  cost?: number | null;
  // Existencia inicial por variante (milésimas). Sirve para cargar la caja que
  // acaba de llegar cuando vienen 3 de cada talle.
  stockPerVariant?: number | null;
  categoryId?: string | null;
  minStock?: number | null;
  unit?: Unit;
  userId?: string | null;
};

export async function createProductVariants(input: CreateVariantsInput) {
  const modelName = input.modelName.trim();

  if (!modelName) {
    throw new ProductError(ProductErrorCode.INVALID_PRODUCT_NAME);
  }

  if (!Number.isInteger(input.price) || input.price <= 0) {
    throw new ProductError(ProductErrorCode.INVALID_PRICE);
  }

  if (input.cost != null && (!Number.isInteger(input.cost) || input.cost < 0)) {
    throw new ProductError(ProductErrorCode.INVALID_COST);
  }

  const variants = generateVariants(modelName, input.axes);

  if (variants.length === 0) {
    throw new ProductError(ProductErrorCode.NO_VARIANTS);
  }

  if (variants.length > MAX_VARIANTS) {
    throw new ProductError(ProductErrorCode.TOO_MANY_VARIANTS);
  }

  const branch = await prisma.branch.findFirst({
    where: { id: input.branchId, businessId: input.businessId, deleted: false, active: true },
    select: { id: true },
  });

  if (!branch) {
    throw new ProductError(ProductErrorCode.BRANCH_NOT_FOUND);
  }

  const unit = input.unit ?? Unit.UNIT;
  const stock = input.stockPerVariant ?? 0;

  const family = await prisma.$transaction(async (tx) => {
    const created = await tx.productFamily.create({
      data: { businessId: input.businessId, name: modelName, createdById: input.userId },
      select: { id: true, name: true },
    });

    for (const variant of variants) {
      const product = await tx.product.create({
        data: {
          businessId: input.businessId,
          familyId: created.id,
          variantLabel: variant.label,
          categoryId: input.categoryId ?? null,
          name: variant.name,
          kind: ProductKind.GOOD,
          unit,
          // El SKU se arma solo: sin él, distinguir quince remeras en una lista
          // es imposible.
          sku: `${slugModel(modelName)}-${variant.skuSuffix}`,
          cost: input.cost ?? null,
          minStock: input.minStock ?? null,
          trackStock: true,
          active: true,
          createdById: input.userId,
          updatedById: input.userId,
        },
        select: { id: true },
      });

      await tx.branchProductPrice.create({
        data: { branchId: branch.id, productId: product.id, price: input.price, active: true },
      });

      if (stock > 0) {
        await applyStockMovement(tx, {
          branchId: branch.id,
          productId: product.id,
          type: StockMovementType.INITIAL,
          quantity: stock,
          unitCost: input.cost ?? null,
          reason: "Carga inicial por variantes",
          createdById: input.userId,
        });
      }
    }

    return created;
  });

  await logEvent("product.variants.create", `${variants.length} variantes de ${family.name}`, {
    businessId: input.businessId,
    userId: input.userId ?? undefined,
    context: { familyId: family.id, variants: variants.length, price: input.price, branchId: branch.id },
  });

  return { familyId: family.id, created: variants.length };
}

function slugModel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 10);
}
