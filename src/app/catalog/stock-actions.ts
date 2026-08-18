"use server";

import { AppModule } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getStockErrorMessageFor, STOCK_MOVEMENT_LABELS } from "@/lib/stock-error-messages";
import { StockError } from "@/modules/stock/stock.errors";
import { adjustStock, receiveStock, registerStockLoss, transferStock } from "@/modules/stock/stock.use-cases";
import {
  findBranchForStock,
  findProductForStock,
  findRecentStockMovements,
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

  // Una merma sin motivo no se guarda. "Se tiraron 3 kg" sin decir por qué es un
  // número que nadie puede accionar: no se sabe si comprar menos, cambiar al
  // proveedor o mirar quién estaba en el turno. La regla la traía la pantalla
  // /mermas, que se eliminó; sin esto se perdía en la mudanza.
  //
  // Va acá y no solo en el panel porque una server action es un endpoint: el
  // botón deshabilitado es una comodidad, no una validación.
  if (input.op === "loss" && !input.reason?.trim()) {
    return { ok: false, error: "Poné por qué se perdió." };
  }

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

/**
 * Mandar existencia a otra sucursal.
 *
 * Vivía en `/stock` como un formulario con un `select` de todos los productos.
 * Es una operación de UN producto —lo único que le falta a la ficha es el
 * destino—, así que se resuelve donde está el producto.
 *
 * Sale de una sucursal y entra en la otra en un solo acto: si la salida se
 * asentara sin la entrada, la mercadería desaparecería del sistema. Eso lo
 * garantiza `transferStock`, que además valida que las dos sucursales sean del
 * negocio y que no sean la misma.
 */
export async function transferProductStockAction(input: {
  productId: string;
  fromBranchId: string;
  toBranchId: string;
  /** Cantidad en milésimas (ver src/lib/quantity.ts). */
  quantity: number;
}): Promise<StockOpResult> {
  const { session } = await requireModule(AppModule.STOCK);

  try {
    await transferStock({
      businessId: session.user.businessId,
      fromBranchId: input.fromBranchId,
      toBranchId: input.toBranchId,
      productId: input.productId,
      quantity: input.quantity,
      userId: session.user.id,
    });
  } catch (error) {
    if (error instanceof StockError) {
      return { ok: false, error: getStockErrorMessageFor(error) };
    }

    await logError("stock.transfer", error, {
      businessId: session.user.businessId,
      userId: session.user.id,
      context: { productId: input.productId, toBranchId: input.toBranchId },
    });
    return { ok: false, error: "No pudimos completar el traspaso. Intentá de nuevo." };
  }

  const level = await prisma.stockLevel.findUnique({
    where: { branchId_productId: { branchId: input.fromBranchId, productId: input.productId } },
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

// ─────────────────────────────────────────────────────────────────────────────
// Movimientos de la sucursal
// ─────────────────────────────────────────────────────────────────────────────

export type MovimientoDeSucursal = {
  id: string;
  productId: string;
  productName: string;
  unit: string;
  quantity: number;
  typeLabel: string;
  reason: string | null;
  whenTs: number;
};

export type MovimientosResult =
  | { ok: true; movimientos: MovimientoDeSucursal[] }
  | { ok: false; error: string };

/**
 * Qué se movió en esta sucursal, cruzando todos los productos.
 *
 * Es la única vista que contesta "qué pasó hoy acá": la ficha muestra los
 * movimientos de UN producto, y revisar producto por producto no es un control,
 * es una auditoría. Importa porque todo lo que baja el stock tiene que poder
 * explicarse — por ahí se escapa un faltante sin que nadie se entere.
 *
 * La sucursal se revalida contra el negocio de la sesión: `findRecentStockMovements`
 * filtra solo por `branchId`, así que sin este chequeo alcanzaría con mandar el
 * id de la sucursal de otro negocio para leerle los movimientos.
 */
export async function getBranchStockMovements(branchId: string): Promise<MovimientosResult> {
  const { session } = await requireModule(AppModule.STOCK);

  const branch = await findBranchForStock(branchId, session.user.businessId);

  if (!branch) {
    return { ok: false, error: "No encontramos esa sucursal." };
  }

  const movimientos = await findRecentStockMovements(branchId);

  return {
    ok: true,
    movimientos: movimientos.map((movimiento) => ({
      id: movimiento.id,
      productId: movimiento.product.id,
      productName: movimiento.product.name,
      unit: movimiento.product.unit,
      quantity: movimiento.quantity,
      typeLabel: STOCK_MOVEMENT_LABELS[movimiento.type],
      reason: movimiento.reason,
      whenTs: movimiento.occurredAt.getTime(),
    })),
  };
}
