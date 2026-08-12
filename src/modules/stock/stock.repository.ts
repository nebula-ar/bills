import type { Prisma } from "@/generated/prisma/client";
import { StockMovementType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { averageCostAfterEntry, averageCostAfterReversal, isEntryMovement } from "./costing.logic";

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
//
// Cuando el movimiento hace ENTRAR mercadería, además recalcula el costo
// promedio ponderado de esa sucursal (ver costing.logic.ts). Las salidas no lo
// tocan: sacan al promedio vigente.
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

  const level = await tx.stockLevel.findUnique({
    where: { branchId_productId: { branchId: input.branchId, productId: input.productId } },
    select: { quantity: true, avgCost: true },
  });

  const avgCost = isEntryMovement(input.type, input.quantity)
    ? averageCostAfterEntry({
        currentQuantity: level?.quantity ?? 0,
        currentAvgCost: level?.avgCost ?? null,
        incomingQuantity: input.quantity,
        incomingUnitCost: input.unitCost ?? null,
      })
    : (level?.avgCost ?? null);

  await tx.stockLevel.upsert({
    where: { branchId_productId: { branchId: input.branchId, productId: input.productId } },
    create: {
      branchId: input.branchId,
      productId: input.productId,
      quantity: input.quantity,
      avgCost,
    },
    update: {
      quantity: { increment: input.quantity },
      avgCost,
    },
  });
}

// Deshace la entrada de una compra: saca las unidades y le quita al promedio
// exactamente el valor que esa compra le había metido. Es lo que hace que
// anular una factura deje el inventario como estaba, en vez de dejar
// mercadería fantasma valuada (ver AGENTS.md: anular revierte, no borra).
export async function reverseStockEntry(
  tx: Tx,
  input: { branchId: string; productId: string; quantity: number; unitCost: number | null; reason: string; purchaseId?: string | null; createdById?: string | null },
) {
  await tx.stockMovement.create({
    data: {
      branchId: input.branchId,
      productId: input.productId,
      type: StockMovementType.PURCHASE_CANCELLED,
      quantity: -input.quantity,
      unitCost: input.unitCost,
      reason: input.reason,
      purchaseId: input.purchaseId ?? null,
      createdById: input.createdById ?? null,
    },
  });

  const level = await tx.stockLevel.findUnique({
    where: { branchId_productId: { branchId: input.branchId, productId: input.productId } },
    select: { quantity: true, avgCost: true },
  });

  const avgCost = averageCostAfterReversal({
    currentQuantity: level?.quantity ?? 0,
    currentAvgCost: level?.avgCost ?? null,
    removedQuantity: input.quantity,
    removedUnitCost: input.unitCost,
  });

  await tx.stockLevel.upsert({
    where: { branchId_productId: { branchId: input.branchId, productId: input.productId } },
    create: { branchId: input.branchId, productId: input.productId, quantity: -input.quantity, avgCost },
    update: { quantity: { decrement: input.quantity }, avgCost },
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

// Costo promedio de esos productos en esa sucursal. Es el costo al que sale la
// mercadería cuando se vende: el que se congela en el renglón de la venta.
export async function findAverageCosts(branchId: string, productIds: string[]) {
  if (productIds.length === 0) {
    return new Map<string, number | null>();
  }

  const levels = await prisma.stockLevel.findMany({
    where: { branchId, productId: { in: productIds } },
    select: { productId: true, avgCost: true },
  });

  return new Map(levels.map((level) => [level.productId, level.avgCost]));
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
      kind: true,
      cost: true,
      minStock: true,
      imageUpdatedAt: true,
      catalogSlug: true,
      category: { select: { id: true, name: true } },
      stockLevels: {
        where: { branchId },
        select: { quantity: true, updatedAt: true, avgCost: true },
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
