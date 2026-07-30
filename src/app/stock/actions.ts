"use server";

import { AppModule } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { logError } from "@/lib/logger";
import { parseQuantityInput } from "@/lib/quantity";
import { getStockErrorMessageFor } from "@/lib/stock-error-messages";
import { StockError } from "@/modules/stock/stock.errors";
import { adjustStock, receiveStock, registerStockLoss, transferStock } from "@/modules/stock/stock.use-cases";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function amount(value: string) {
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export async function adjustStockAction(formData: FormData) {
  const { session } = await requireModule(AppModule.STOCK);

  const branchId = text(formData, "branchId");
  const productId = text(formData, "productId");
  const counted = parseQuantityInput(text(formData, "counted"));

  if (counted === null && text(formData, "counted") !== "0") {
    back(branchId, "error", "Ingresá una cantidad válida.");
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
    handle(error, branchId, "stock.adjust", session.user.businessId, session.user.id);
  }

  back(branchId, "success", "Stock actualizado.");
}

export async function registerLossAction(formData: FormData) {
  const { session } = await requireModule(AppModule.STOCK);

  const branchId = text(formData, "branchId");
  const quantity = parseQuantityInput(text(formData, "quantity"));

  if (quantity === null) {
    back(branchId, "error", "Ingresá una cantidad válida.");
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
    handle(error, branchId, "stock.loss", session.user.businessId, session.user.id);
  }

  back(branchId, "success", "Merma registrada.");
}

export async function receiveStockAction(formData: FormData) {
  const { session } = await requireModule(AppModule.STOCK);

  const branchId = text(formData, "branchId");
  const quantity = parseQuantityInput(text(formData, "quantity"));
  const unitCost = text(formData, "unitCost") ? amount(text(formData, "unitCost")) : null;

  if (quantity === null) {
    back(branchId, "error", "Ingresá una cantidad válida.");
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
    handle(error, branchId, "stock.receive", session.user.businessId, session.user.id);
  }

  back(branchId, "success", "Mercadería ingresada.");
}

export async function transferStockAction(formData: FormData) {
  const { session } = await requireModule(AppModule.STOCK);

  const branchId = text(formData, "branchId");
  const quantity = parseQuantityInput(text(formData, "quantity"));

  if (quantity === null) {
    back(branchId, "error", "Ingresá una cantidad válida.");
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
    handle(error, branchId, "stock.transfer", session.user.businessId, session.user.id);
  }

  back(branchId, "success", "Traspaso registrado.");
}

function handle(error: unknown, branchId: string, event: string, businessId: string, userId: string): never {
  if (error instanceof StockError) {
    back(branchId, "error", getStockErrorMessageFor(error));
  }

  void logError(event, error, { businessId, userId });
  back(branchId, "error", "No pudimos completar la operación. Intentá de nuevo.");
}

function back(branchId: string, status: "success" | "error", message: string): never {
  // La acción acabó de mutar datos y el redirect vuelve a la MISMA ruta: sin
  // invalidarla, el router del cliente puede servir el árbol que ya tenía y el
  // usuario ve el valor de antes (visto de verdad: un ajuste de stock a 50 que
  // seguía mostrando 111).
  revalidatePath("/stock");

  const params = new URLSearchParams({ status, message });
  if (branchId) params.set("branchId", branchId);
  redirect(`/stock?${params.toString()}`);
}
