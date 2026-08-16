import type { ProductKind, Unit } from "@/generated/prisma/client";

import { ProductError, ProductErrorCode } from "./product.errors";
import { findProductManagementProductById, recordProductChanges, updateProductDetails } from "./product.repository";
import { CAMPOS_DE_PRODUCTO, diffDeProducto } from "./product-change.logic";

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
  idealStock?: number | null;
  packSize?: number | null;
  packLabel?: string | null;
  categoryId?: string | null;
  // Quién está guardando. Opcional: hay ediciones que hace el sistema, y ahí
  // el historial no inventa un autor.
  changedById?: string | null;
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

  // El historial se arma ANTES de escribir, con el producto tal como está en la
  // base: después del update el "antes" ya no existe. Se guarda igual aunque
  // falle nada, porque `updateProductDetails` recién corre abajo.
  const cambios = diffDeProducto({
    anterior: {
      name: product.name,
      cost: product.cost,
      description: product.description,
      sku: product.sku,
      barcode: product.barcode,
      minStock: product.minStock,
      idealStock: product.idealStock,
      categoryId: product.categoryId,
    },
    siguiente: {
      name,
      cost: input.cost,
      description: description && description.length > 0 ? description : undefined,
      sku: input.sku,
      barcode: input.barcode,
      minStock: input.minStock,
      idealStock: input.idealStock,
      categoryId: input.categoryId,
    },
    campos: [...CAMPOS_DE_PRODUCTO],
  });

  const actualizado = await updateProductDetails({
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
    idealStock: input.idealStock,
    packSize: input.packSize,
    packLabel: input.packLabel,
    categoryId: input.categoryId,
  });

  // Después del update y no dentro: si el historial falla, el cambio del
  // producto igual quedó guardado. Al revés —perder la edición porque no se
  // pudo anotar— sería peor para quien está trabajando.
  await recordProductChanges({
    productId: product.id,
    businessId: input.businessId,
    changedById: input.changedById,
    cambios,
  });

  return actualizado;
}
