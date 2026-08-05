"use server";

import { AppModule } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { logError } from "@/lib/logger";
import { parseQuantityInput } from "@/lib/quantity";
import { getStockErrorMessageFor } from "@/lib/stock-error-messages";
import { StockError } from "@/modules/stock/stock.errors";
import { adjustStock, receiveStock, registerStockLoss, transferStock } from "@/modules/stock/stock.use-cases";

export type StockActionResult = { ok: boolean; message: string };

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function amount(value: string) {
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export async function adjustStockAction(formData: FormData): Promise<StockActionResult> {
  const { session } = await requireModule(AppModule.STOCK);

  const branchId = text(formData, "branchId");
  const productId = text(formData, "productId");
  const counted = parseQuantityInput(text(formData, "counted"));

  if (counted === null && text(formData, "counted") !== "0") {
    return { ok: false, message: "Ingresá una cantidad válida." };
  }

  try {
    await adjustStock({
      businessId: session.user.businessId,
      branchId,
      productId,
      // Un conteo puede dar cero (se acabó): `parseQuantityInput` rechaza el 0
      // porque para vender no sirve, pero para un ajuste es un valor legítimo.
      countedQuantity: counted ?? 0,
      reason: text(formData, "reason") || undefined,
      userId: session.user.id,
    });
  } catch (error) {
    return handle(error, "stock.adjust", session.user.businessId, session.user.id);
  }

  return { ok: true, message: "Stock actualizado." };
}

export async function registerLossAction(formData: FormData): Promise<StockActionResult> {
  const { session } = await requireModule(AppModule.STOCK);

  const branchId = text(formData, "branchId");
  const quantity = parseQuantityInput(text(formData, "quantity"));

  if (quantity === null) {
    return { ok: false, message: "Ingresá una cantidad válida." };
  }

  try {
    await registerStockLoss({
      businessId: session.user.businessId,
      branchId,
      productId: text(formData, "productId"),
      quantity,
      reason: text(formData, "reason") || undefined,
      userId: session.user.id,
    });
  } catch (error) {
    return handle(error, "stock.loss", session.user.businessId, session.user.id);
  }

  return { ok: true, message: "Merma registrada." };
}

export async function receiveStockAction(formData: FormData): Promise<StockActionResult> {
  const { session } = await requireModule(AppModule.STOCK);

  const branchId = text(formData, "branchId");
  const quantity = parseQuantityInput(text(formData, "quantity"));
  const unitCost = text(formData, "unitCost") ? amount(text(formData, "unitCost")) : null;

  if (quantity === null) {
    return { ok: false, message: "Ingresá una cantidad válida." };
  }

  try {
    await receiveStock({
      businessId: session.user.businessId,
      branchId,
      productId: text(formData, "productId"),
      quantity,
      unitCost,
      reason: text(formData, "reason") || undefined,
      userId: session.user.id,
    });
  } catch (error) {
    return handle(error, "stock.receive", session.user.businessId, session.user.id);
  }

  return { ok: true, message: "Mercadería ingresada." };
}

export async function transferStockAction(formData: FormData): Promise<StockActionResult> {
  const { session } = await requireModule(AppModule.STOCK);

  const branchId = text(formData, "branchId");
  const quantity = parseQuantityInput(text(formData, "quantity"));

  if (quantity === null) {
    return { ok: false, message: "Ingresá una cantidad válida." };
  }

  try {
    await transferStock({
      businessId: session.user.businessId,
      fromBranchId: branchId,
      toBranchId: text(formData, "toBranchId"),
      productId: text(formData, "productId"),
      quantity,
      userId: session.user.id,
    });
  } catch (error) {
    return handle(error, "stock.transfer", session.user.businessId, session.user.id);
  }

  return { ok: true, message: "Traspaso registrado." };
}

function handle(error: unknown, event: string, businessId: string, userId: string): StockActionResult {
  if (error instanceof StockError) {
    return { ok: false, message: getStockErrorMessageFor(error) };
  }

  void logError(event, error, { businessId, userId });
  return { ok: false, message: "No pudimos completar la operación. Intentá de nuevo." };
}
