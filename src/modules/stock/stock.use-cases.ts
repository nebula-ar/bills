import { StockMovementType, type Unit } from "@/generated/prisma/client";
import { logEvent } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { lineTotal } from "@/lib/quantity";

import { StockError, StockErrorCode } from "./stock.errors";
import {
  applyStockMovement,
  findBranchForStock,
  findBranchStock,
  findProductForStock,
  findRecentStockMovements,
} from "./stock.repository";

export type StockRow = {
  productId: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unit: Unit;
  categoryName: string | null;
  quantity: number;
  minStock: number | null;
  cost: number | null;
  price: number | null;
  // Plata inmovilizada en este producto (costo × existencia).
  stockValue: number;
  status: "ok" | "low" | "out";
};

// Inventario de una sucursal, listo para pintar: existencia, valorización y
// semáforo de reposición.
export async function getBranchStockOverview(businessId: string, branchId: string) {
  const products = await findBranchStock(businessId, branchId);

  const rows: StockRow[] = products.map((product) => {
    const quantity = product.stockLevels[0]?.quantity ?? 0;
    const minStock = product.minStock;

    const status: StockRow["status"] =
      quantity <= 0 ? "out" : minStock !== null && quantity <= minStock ? "low" : "ok";

    // Se valúa al promedio ponderado de lo que hay, no al último costo pagado:
    // valuar mercadería vieja al precio de la última compra infla el patrimonio
    // (ver costing.logic.ts). El costo del producto queda de respaldo para el
    // stock que entró antes de que hubiera promedio.
    const valuationCost = product.stockLevels[0]?.avgCost ?? product.cost;

    return {
      productId: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      unit: product.unit,
      categoryName: product.category?.name ?? null,
      quantity,
      minStock,
      cost: product.cost,
      price: product.branchPrices[0]?.price ?? null,
      stockValue: valuationCost ? lineTotal(valuationCost, Math.max(quantity, 0)) : 0,
      status,
    };
  });

  return {
    rows,
    totals: {
      products: rows.length,
      value: rows.reduce((total, row) => total + row.stockValue, 0),
      low: rows.filter((row) => row.status === "low").length,
      out: rows.filter((row) => row.status === "out").length,
    },
  };
}

export function getStockMovements(branchId: string, limit?: number) {
  return findRecentStockMovements(branchId, limit);
}

type StockOperationInput = {
  businessId: string;
  branchId: string;
  productId: string;
  userId?: string | null;
  reason?: string;
};

// Ajuste por conteo: el usuario dice cuánto hay DE VERDAD y nosotros asentamos
// la diferencia. Nunca se pisa el saldo a mano — así el libro de movimientos
// sigue explicando cada unidad.
export async function adjustStock(input: StockOperationInput & { countedQuantity: number }) {
  const { product } = await requireStockTarget(input);

  if (!Number.isInteger(input.countedQuantity) || input.countedQuantity < 0) {
    throw new StockError(StockErrorCode.INVALID_QUANTITY);
  }

  const level = await prisma.stockLevel.findUnique({
    where: { branchId_productId: { branchId: input.branchId, productId: input.productId } },
    select: { quantity: true },
  });

  const current = level?.quantity ?? 0;
  const delta = input.countedQuantity - current;

  if (delta === 0) {
    return { delta: 0, quantity: current };
  }

  await prisma.$transaction(async (tx) => {
    await applyStockMovement(tx, {
      branchId: input.branchId,
      productId: input.productId,
      type: level ? StockMovementType.ADJUSTMENT : StockMovementType.INITIAL,
      quantity: delta,
      unitCost: product.cost,
      reason: input.reason ?? "Ajuste por conteo",
      createdById: input.userId,
    });
  });

  await logEvent("stock.adjust", `Ajuste de stock de ${product.name}`, {
    businessId: input.businessId,
    userId: input.userId ?? undefined,
    context: { productId: product.id, branchId: input.branchId, from: current, to: input.countedQuantity },
  });

  return { delta, quantity: input.countedQuantity };
}

// Merma: rotura, vencimiento o robo. Sale del stock y queda registrado con su
// motivo, que es justamente lo que el dueño quiere poder mirar a fin de mes.
export async function registerStockLoss(input: StockOperationInput & { quantity: number }) {
  const { product } = await requireStockTarget(input);

  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new StockError(StockErrorCode.INVALID_QUANTITY);
  }

  await prisma.$transaction(async (tx) => {
    await applyStockMovement(tx, {
      branchId: input.branchId,
      productId: input.productId,
      type: StockMovementType.LOSS,
      quantity: -input.quantity,
      unitCost: product.cost,
      reason: input.reason ?? "Merma",
      createdById: input.userId,
    });
  });

  await logEvent("stock.loss", `Merma de ${product.name}`, {
    businessId: input.businessId,
    userId: input.userId ?? undefined,
    context: { productId: product.id, branchId: input.branchId, quantity: input.quantity, reason: input.reason },
  });
}

// Ingreso de mercadería sin factura de proveedor cargada (el caso del que
// compra en el mayorista y trae el ticket después).
export async function receiveStock(input: StockOperationInput & { quantity: number; unitCost?: number | null }) {
  const { product } = await requireStockTarget(input);

  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new StockError(StockErrorCode.INVALID_QUANTITY);
  }

  if (input.unitCost !== undefined && input.unitCost !== null && (!Number.isInteger(input.unitCost) || input.unitCost < 0)) {
    throw new StockError(StockErrorCode.INVALID_COST);
  }

  await prisma.$transaction(async (tx) => {
    await applyStockMovement(tx, {
      branchId: input.branchId,
      productId: input.productId,
      type: StockMovementType.PURCHASE,
      quantity: input.quantity,
      unitCost: input.unitCost ?? product.cost,
      reason: input.reason ?? "Ingreso de mercadería",
      createdById: input.userId,
    });

    // Si vino un costo nuevo, actualizamos el del producto: es el costo de
    // reposición más fresco que tenemos y de ahí sale el margen.
    if (input.unitCost !== undefined && input.unitCost !== null && input.unitCost !== product.cost) {
      await tx.product.update({ where: { id: product.id }, data: { cost: input.unitCost } });
    }
  });

  await logEvent("stock.receive", `Ingreso de ${product.name}`, {
    businessId: input.businessId,
    userId: input.userId ?? undefined,
    context: { productId: product.id, branchId: input.branchId, quantity: input.quantity },
  });
}

// Traspaso entre sucursales: dos movimientos espejo en una sola transacción,
// para que nunca exista un instante donde la mercadería esté en las dos o en
// ninguna.
export async function transferStock(input: {
  businessId: string;
  fromBranchId: string;
  toBranchId: string;
  productId: string;
  quantity: number;
  userId?: string | null;
  reason?: string;
}) {
  if (input.fromBranchId === input.toBranchId) {
    throw new StockError(StockErrorCode.SAME_BRANCH_TRANSFER);
  }

  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new StockError(StockErrorCode.INVALID_QUANTITY);
  }

  const [product, from, to] = await Promise.all([
    findProductForStock(input.productId, input.businessId),
    findBranchForStock(input.fromBranchId, input.businessId),
    findBranchForStock(input.toBranchId, input.businessId),
  ]);

  if (!product) throw new StockError(StockErrorCode.PRODUCT_NOT_FOUND);
  if (!product.trackStock) throw new StockError(StockErrorCode.PRODUCT_NOT_TRACKED, { productName: product.name });
  if (!from || !to) throw new StockError(StockErrorCode.BRANCH_NOT_FOUND);

  const level = await prisma.stockLevel.findUnique({
    where: { branchId_productId: { branchId: input.fromBranchId, productId: input.productId } },
    select: { quantity: true },
  });

  if ((level?.quantity ?? 0) < input.quantity) {
    throw new StockError(StockErrorCode.INSUFFICIENT_STOCK, {
      productName: product.name,
      available: level?.quantity ?? 0,
    });
  }

  const reason = input.reason ?? `Traspaso ${from.name} → ${to.name}`;

  await prisma.$transaction(async (tx) => {
    await applyStockMovement(tx, {
      branchId: input.fromBranchId,
      productId: input.productId,
      type: StockMovementType.TRANSFER_OUT,
      quantity: -input.quantity,
      unitCost: product.cost,
      reason,
      createdById: input.userId,
    });

    await applyStockMovement(tx, {
      branchId: input.toBranchId,
      productId: input.productId,
      type: StockMovementType.TRANSFER_IN,
      quantity: input.quantity,
      unitCost: product.cost,
      reason,
      createdById: input.userId,
    });
  });

  await logEvent("stock.transfer", `Traspaso de ${product.name}`, {
    businessId: input.businessId,
    userId: input.userId ?? undefined,
    context: { productId: product.id, from: input.fromBranchId, to: input.toBranchId, quantity: input.quantity },
  });
}

async function requireStockTarget(input: StockOperationInput) {
  const [product, branch] = await Promise.all([
    findProductForStock(input.productId, input.businessId),
    findBranchForStock(input.branchId, input.businessId),
  ]);

  if (!product) {
    throw new StockError(StockErrorCode.PRODUCT_NOT_FOUND);
  }

  if (!product.trackStock) {
    throw new StockError(StockErrorCode.PRODUCT_NOT_TRACKED, { productName: product.name });
  }

  if (!branch) {
    throw new StockError(StockErrorCode.BRANCH_NOT_FOUND);
  }

  return { product, branch };
}
