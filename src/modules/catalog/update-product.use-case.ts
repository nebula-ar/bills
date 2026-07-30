import type { ProductKind, Unit } from "@/generated/prisma/client";

import { ProductError, ProductErrorCode } from "./product.errors";
import { findProductManagementProductById, updateProductDetails } from "./product.repository";

export type UpdateGlobalProductInput = {
  businessId: string;
  productId: string;
  name: string;
  description?: string;
  // Datos comerciales: opcionales a propósito. Una barbería no los toca nunca;
  // un kiosco o una verdulería viven de ellos.
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

export async function updateGlobalProduct(input: UpdateGlobalProductInput) {
  const name = input.name.trim();

  if (name.length === 0) {
    throw new ProductError(ProductErrorCode.INVALID_PRODUCT_NAME);
  }

  const product = await findProductManagementProductById(input.productId, input.businessId);

  if (!product) {
    throw new ProductError(ProductErrorCode.PRODUCT_NOT_FOUND);
  }

  if (input.cost !== undefined && input.cost !== null && (!Number.isInteger(input.cost) || input.cost < 0)) {
    throw new ProductError(ProductErrorCode.INVALID_COST);
  }

  if (
    input.minStock !== undefined &&
    input.minStock !== null &&
    (!Number.isInteger(input.minStock) || input.minStock < 0)
  ) {
    throw new ProductError(ProductErrorCode.INVALID_MIN_STOCK);
  }

  const description = input.description?.trim();

  return updateProductDetails({
    productId: product.id,
    name,
    description: description && description.length > 0 ? description : undefined,
    kind: input.kind,
    unit: input.unit,
    sku: input.sku,
    barcode: input.barcode,
    cost: input.cost,
    trackStock: input.trackStock,
    minStock: input.minStock,
    packSize: input.packSize,
    packLabel: input.packLabel,
    categoryId: input.categoryId,
  });
}
