"use server";

import { AppModule } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getStockErrorMessageFor } from "@/lib/stock-error-messages";
import { StockError } from "@/modules/stock/stock.errors";
import { adjustStock, receiveStock, registerStockLoss } from "@/modules/stock/stock.use-cases";
import {
  findBranchForStock,
  findProductForStock,
  findStockExpiry,
  setStockExpiry,
} from "@/modules/stock/stock.repository";

// Operaciones de stock sobre UN producto, disparadas desde su propia ficha.
//
// Existían solo en la pantalla de Stock, donde había que volver a elegir el
// producto en un `select` de doscientas opciones —justo el que ya estabas
// mirando—. Acá el producto ya está: se toca "Ajustar" y se escribe el número.
//
// Devuelven resultado en vez de redirigir: el redirect a la misma ruta no
// refresca el árbol y la existencia seguiría mostrando el valor viejo.

export type StockOpResult = { ok: true; quantity: number } | { ok: false; error: string };

export type StockOp = "adjust" | "receive" | "loss";

export async function applyProductStockAction(input: {
  op: StockOp;
  productId: string;
  branchId: string;
  // Cantidad en milésimas (ver src/lib/quantity.ts).
  quantity: number;
  reason?: string;
  unitCost?: number | null;
}): Promise<StockOpResult> {
  const { session } = await requireModule(AppModule.STOCK);

  const common = {
    businessId: session.user.businessId,
    branchId: input.branchId,
    productId: input.productId,
    reason: input.reason?.trim() || undefined,
    userId: session.user.id,
  };

  try {
    if (input.op === "adjust") {
      await adjustStock({ ...common, countedQuantity: input.quantity });
    } else if (input.op === "receive") {
      await receiveStock({ ...common, quantity: input.quantity, unitCost: input.unitCost ?? null });
    } else {
      await registerStockLoss({ ...common, quantity: input.quantity });
    }
  } catch (error) {
    if (error instanceof StockError) {
      return { ok: false, error: getStockErrorMessageFor(error) };
    }

    await logError(`stock.${input.op}`, error, {
      businessId: session.user.businessId,
      userId: session.user.id,
      context: { productId: input.productId, branchId: input.branchId },
    });
    return { ok: false, error: "No pudimos completar la operación. Intentá de nuevo." };
  }

  // El panel conserva el valor confirmado localmente y refresca el catálogo
  // al cerrar la ficha. Revalidar dentro de esta Server Action haría que Next
  // entregue un árbol RSC nuevo y reemplazaría el formulario en medio de una
  // segunda operación rápida.

  const level = await prisma.stockLevel.findUnique({
    where: { branchId_productId: { branchId: input.branchId, productId: input.productId } },
    select: { quantity: true },
  });
  return { ok: true, quantity: level?.quantity ?? 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Vencimiento
// ─────────────────────────────────────────────────────────────────────────────

export type ExpiryResult = { ok: true; expiresAt: string | null } | { ok: false; error: string };

/**
 * Cuándo se vence lo que hay de este producto en esta sucursal.
 *
 * Vivía únicamente en la pestaña Insumos de `/recetas`, que se elimina. Es un
 * dato del stock —va sobre `StockLevel`, por sucursal, porque dos bolsas del
 * mismo insumo vencen distinto—, así que su lugar es el inventario del
 * producto y no una pantalla aparte.
 *
 * La sucursal y el producto se revalidan contra el negocio de la sesión ANTES
 * de escribir. La acción vieja no lo hacía: tomaba los dos ids crudos del
 * formulario y solo chequeaba que hubiera sesión y módulo, así que un usuario
 * de un negocio podía escribirle el vencimiento al stock de otro.
 */
export async function getProductExpiry(productId: string, branchId: string): Promise<ExpiryResult> {
  const { session } = await requireModule(AppModule.STOCK);

  const [product, branch] = await Promise.all([
    findProductForStock(productId, session.user.businessId),
    findBranchForStock(branchId, session.user.businessId),
  ]);

  if (!product || !branch) {
    return { ok: false, error: "No encontramos ese producto en esta sucursal." };
  }

  const nivel = await findStockExpiry(branchId, productId);

  return {
    ok: true,
    // ISO corto: es lo que espera un <input type="date">.
    expiresAt: nivel?.expiresAt ? nivel.expiresAt.toISOString().slice(0, 10) : null,
  };
}

export async function setProductExpiry(input: {
  productId: string;
  branchId: string;
  /** "2026-09-30" o "" para borrarlo. */
  expiresAt: string;
}): Promise<ExpiryResult> {
  const { session } = await requireModule(AppModule.STOCK);

  const [product, branch] = await Promise.all([
    findProductForStock(input.productId, session.user.businessId),
    findBranchForStock(input.branchId, session.user.businessId),
  ]);

  if (!product || !branch) {
    return { ok: false, error: "No encontramos ese producto en esta sucursal." };
  }

  const crudo = input.expiresAt.trim();

  // Se guarda en UTC a mediodía y no a medianoche: con "T00:00:00Z" una fecha
  // cargada en Buenos Aires (UTC−3) se lee como el día anterior al formatearla
  // en hora local, y el insumo aparece venciendo un día antes.
  const fecha = crudo ? new Date(`${crudo}T12:00:00Z`) : null;

  if (crudo && Number.isNaN(fecha!.getTime())) {
    return { ok: false, error: "Esa fecha no es válida." };
  }

  try {
    await setStockExpiry({
      businessId: session.user.businessId,
      branchId: input.branchId,
      productId: input.productId,
      expiresAt: fecha,
    });
  } catch (error) {
    await logError("stock.expiry", error, {
      businessId: session.user.businessId,
      userId: session.user.id,
      context: { productId: input.productId, branchId: input.branchId },
    });
    return { ok: false, error: "No pudimos guardar el vencimiento. Intentá de nuevo." };
  }

  return { ok: true, expiresAt: crudo || null };
}
