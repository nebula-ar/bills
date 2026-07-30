import type { Prisma } from "@/generated/prisma/client";
import { StockMovementType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// Cliente de Prisma dentro de una transacción. El stock siempre se mueve junto
// con lo que lo causó (una venta, una compra), así que casi todo acá recibe el
// `tx` de quien lo llama en vez de abrir su propia transacción.
export type Tx = Prisma.TransactionClient;

export type StockMovementInput = {
  branchId: string;
  productId: string;
  type: StockMovementType;
  // Con signo: positivo entra, negativo sale. En milésimas (ver src/lib/quantity.ts).
  quantity: number;
  unitCost?: number | null;
  reason?: string | null;
  saleId?: string | null;
  purchaseId?: string | null;
  occurredAt?: Date;
  createdById?: string | null;
};

// Asienta un movimiento y actualiza el saldo del producto en la sucursal.
// Las dos escrituras van juntas: StockLevel es un caché de StockMovement y no
// puede quedar desfasado.
export async function applyStockMovement(tx: Tx, input: StockMovementInput) {
  await tx.stockMovement.create({
    data: {
      branchId: input.branchId,
      productId: input.productId,
      type: input.type,
      quantity: input.quantity,
      unitCost: input.unitCost ?? null,
      reason: input.reason ?? null,
      saleId: input.saleId ?? null,
      purchaseId: input.purchaseId ?? null,
      occurredAt: input.occurredAt,
      createdById: input.createdById ?? null,
    },
  });

  await tx.stockLevel.upsert({
    where: { branchId_productId: { branchId: input.branchId, productId: input.productId } },
    create: {
      branchId: input.branchId,
      productId: input.productId,
      quantity: input.quantity,
    },
    update: {
      quantity: { increment: input.quantity },
    },
  });
}

// Aplica varios movimientos del mismo tipo (ej: todos los renglones de una venta).
export async function applyStockMovements(tx: Tx, movements: StockMovementInput[]) {
  for (const movement of movements) {
    await applyStockMovement(tx, movement);
  }
}

// Existencias actuales de un conjunto de productos en una sucursal. Devuelve un
// Map para poder chequear disponibilidad sin N queries.
export async function findStockLevels(branchId: string, productIds: string[]) {
  if (productIds.length === 0) {
    return new Map<string, number>();
  }

  const levels = await prisma.stockLevel.findMany({
    where: { branchId, productId: { in: productIds } },
    select: { productId: true, quantity: true },
  });

  return new Map(levels.map((level) => [level.productId, level.quantity]));
}

// Inventario completo de una sucursal: qué hay, cuánto vale y qué falta.
export function findBranchStock(businessId: string, branchId: string) {
  return prisma.product.findMany({
    where: {
      businessId,
      deleted: false,
      active: true,
      trackStock: true,
    },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      sku: true,
      barcode: true,
      unit: true,
      cost: true,
      minStock: true,
      category: { select: { id: true, name: true } },
      stockLevels: {
        where: { branchId },
        select: { quantity: true, updatedAt: true },
      },
      branchPrices: {
        where: { branchId, deleted: false },
        select: { price: true },
      },
    },
  });
}

export function findProductForStock(productId: string, businessId: string) {
  return prisma.product.findFirst({
    where: { id: productId, businessId, deleted: false },
    select: { id: true, name: true, unit: true, cost: true, trackStock: true },
  });
}

export function findBranchForStock(branchId: string, businessId: string) {
  return prisma.branch.findFirst({
    where: { id: branchId, businessId, deleted: false, active: true },
    select: { id: true, name: true },
  });
}

// Últimos movimientos de una sucursal, para la pantalla de historial.
export function findRecentStockMovements(branchId: string, limit = 50) {
  return prisma.stockMovement.findMany({
    where: { branchId },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true,
      type: true,
      quantity: true,
      unitCost: true,
      reason: true,
      occurredAt: true,
      product: { select: { id: true, name: true, unit: true } },
    },
  });
}

// Productos por debajo del punto de reposición. Es la consulta que alimenta el
// aviso de "falta reponer" en el inicio.
export async function findLowStockProducts(businessId: string, branchId?: string) {
  const products = await prisma.product.findMany({
    where: {
      businessId,
      deleted: false,
      active: true,
      trackStock: true,
      minStock: { not: null },
    },
    select: {
      id: true,
      name: true,
      unit: true,
      minStock: true,
      stockLevels: {
        where: branchId ? { branchId } : undefined,
        select: { quantity: true, branchId: true, branch: { select: { name: true } } },
      },
    },
  });

  // El filtro "por debajo del mínimo" compara dos columnas, algo que Prisma no
  // expresa en el where: se resuelve acá, sobre un set ya acotado a los
  // productos con mínimo configurado.
  return products.flatMap((product) => {
    const minStock = product.minStock ?? 0;

    return product.stockLevels
      .filter((level) => level.quantity <= minStock)
      .map((level) => ({
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        minStock,
        quantity: level.quantity,
        branchId: level.branchId,
        branchName: level.branch.name,
      }));
  });
}

export const STOCK_OUT_TYPES = [
  StockMovementType.SALE,
  StockMovementType.TRANSFER_OUT,
  StockMovementType.LOSS,
] as const;

// Existencias de varias sucursales a la vez, para el POS (que puede ofrecer más
// de una caja). La clave del Map es `${branchId}:${productId}`.
export async function findStockLevelsForBranches(branchIds: string[]) {
  if (branchIds.length === 0) {
    return new Map<string, number>();
  }

  const levels = await prisma.stockLevel.findMany({
    where: { branchId: { in: branchIds } },
    select: { branchId: true, productId: true, quantity: true },
  });

  return new Map(levels.map((level) => [`${level.branchId}:${level.productId}`, level.quantity]));
}
