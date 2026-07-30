"use server";

import { AppModule, PaymentMethod, Unit } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { logError } from "@/lib/logger";
import { parsePaymentMethodValue } from "@/lib/payment-labels";
import { parseQuantityInput } from "@/lib/quantity";
import { getSupplierErrorMessageFor } from "@/lib/supplier-error-messages";
import { SupplierError } from "@/modules/suppliers/supplier.errors";
import {
  cancelPurchase,
  createPurchase,
  createSupplier,
  deletePurchase,
  deleteSupplier,
  registerPurchasePayment,
  updateSupplier,
} from "@/modules/suppliers/supplier.use-cases";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function money(value: string): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

// Fecha de un <input type="date"> al inicio del día local.
function date(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0) : null;
}

function unit(value: string): Unit {
  return (Object.values(Unit) as string[]).includes(value) ? (value as Unit) : Unit.UNIT;
}

export async function createSupplierAction(formData: FormData) {
  const { session } = await requireModule(AppModule.SUPPLIERS);

  try {
    await createSupplier({
      businessId: session.user.businessId,
      userId: session.user.id,
      name: text(formData, "name"),
      taxId: text(formData, "taxId") || null,
      phone: text(formData, "phone") || null,
      email: text(formData, "email") || null,
      address: text(formData, "address") || null,
      notes: text(formData, "notes") || null,
    });
  } catch (error) {
    handle(error, "supplier.create", session.user.businessId, session.user.id);
  }

  back("success", "Proveedor creado.");
}

export async function updateSupplierAction(formData: FormData) {
  const { session } = await requireModule(AppModule.SUPPLIERS);
  const supplierId = text(formData, "supplierId");

  try {
    await updateSupplier(supplierId, {
      businessId: session.user.businessId,
      userId: session.user.id,
      name: text(formData, "name"),
      taxId: text(formData, "taxId") || null,
      phone: text(formData, "phone") || null,
      email: text(formData, "email") || null,
      address: text(formData, "address") || null,
      notes: text(formData, "notes") || null,
      active: formData.get("active") !== null,
    });
  } catch (error) {
    handle(error, "supplier.update", session.user.businessId, session.user.id, supplierId);
  }

  back("success", "Proveedor actualizado.", supplierId);
}

export async function deleteSupplierAction(formData: FormData) {
  const { session } = await requireModule(AppModule.SUPPLIERS);

  try {
    await deleteSupplier(text(formData, "supplierId"), session.user.businessId, session.user.id);
  } catch (error) {
    handle(error, "supplier.delete", session.user.businessId, session.user.id);
  }

  back("success", "Proveedor eliminado.");
}

// Carga una factura de compra con sus renglones. Los ítems vienen como campos
// paralelos (item-product[], item-qty[]...) porque el formulario es HTML puro.
export async function createPurchaseAction(formData: FormData) {
  const { session } = await requireModule(AppModule.SUPPLIERS);

  const productIds = formData.getAll("itemProductId").map(String);
  const descriptions = formData.getAll("itemDescription").map(String);
  const quantities = formData.getAll("itemQuantity").map(String);
  const units = formData.getAll("itemUnit").map(String);
  const costs = formData.getAll("itemUnitCost").map(String);

  const items = productIds
    .map((productId, index) => ({
      productId: productId || null,
      description: descriptions[index]?.trim() ?? "",
      quantity: parseQuantityInput(quantities[index] ?? "") ?? 0,
      unit: unit(units[index] ?? ""),
      unitCost: money(costs[index] ?? "") ?? 0,
    }))
    // Renglones vacíos: el formulario ofrece varias filas y no hace falta llenarlas todas.
    .filter((item) => item.quantity > 0 && (item.productId || item.description));

  if (items.length === 0) {
    back("error", "Cargá al menos un ítem con cantidad.");
  }

  try {
    await createPurchase({
      businessId: session.user.businessId,
      userId: session.user.id,
      branchId: text(formData, "branchId") || null,
      supplierId: text(formData, "supplierId"),
      number: text(formData, "number") || null,
      issuedAt: date(text(formData, "issuedAt")) ?? new Date(),
      dueAt: date(text(formData, "dueAt")),
      notes: text(formData, "notes") || null,
      items,
    });
  } catch (error) {
    handle(error, "purchase.create", session.user.businessId, session.user.id);
  }

  back("success", "Factura de compra cargada.");
}

export async function payPurchaseAction(formData: FormData) {
  const { session } = await requireModule(AppModule.SUPPLIERS);

  const amount = money(text(formData, "amount"));
  const method = parsePaymentMethodValue(formData.get("method")) ?? PaymentMethod.CASH;

  if (!amount || amount <= 0) {
    back("error", "Ingresá un importe válido.");
  }

  try {
    await registerPurchasePayment({
      purchaseId: text(formData, "purchaseId"),
      businessId: session.user.businessId,
      userId: session.user.id,
      amount,
      method,
      note: text(formData, "note") || null,
    });
  } catch (error) {
    handle(error, "purchase.payment", session.user.businessId, session.user.id);
  }

  back("success", "Pago registrado.");
}

export async function cancelPurchaseAction(formData: FormData) {
  const { session } = await requireModule(AppModule.SUPPLIERS);

  try {
    await cancelPurchase(text(formData, "purchaseId"), session.user.businessId, session.user.id);
  } catch (error) {
    handle(error, "purchase.cancel", session.user.businessId, session.user.id);
  }

  back("success", "Factura anulada.");
}

export async function deletePurchaseAction(formData: FormData) {
  const { session } = await requireModule(AppModule.SUPPLIERS);

  try {
    await deletePurchase(text(formData, "purchaseId"), session.user.businessId, session.user.id);
  } catch (error) {
    handle(error, "purchase.delete", session.user.businessId, session.user.id);
  }

  back("success", "Factura eliminada.");
}

function handle(error: unknown, event: string, businessId: string, userId: string, supplierId?: string): never {
  if (error instanceof SupplierError) {
    back("error", getSupplierErrorMessageFor(error), supplierId);
  }

  void logError(event, error, { businessId, userId });
  back("error", "No pudimos completar la operación. Intentá de nuevo.", supplierId);
}

function back(status: "success" | "error", message: string, supplierId?: string): never {
  // La acción acabó de mutar datos y el redirect vuelve a la MISMA ruta: sin
  // invalidarla, el router del cliente puede servir el árbol que ya tenía y el
  // usuario ve el valor de antes (visto de verdad: un ajuste de stock a 50 que
  // seguía mostrando 111).
  revalidatePath("/suppliers");

  const params = new URLSearchParams({ status, message });
  if (supplierId) params.set("supplierId", supplierId);
  redirect(`/suppliers?${params.toString()}`);
}
