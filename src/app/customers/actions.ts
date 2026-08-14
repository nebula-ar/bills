"use server";

import { AppModule, PaymentMethod, TaxCondition } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { getCustomerErrorMessageFor } from "@/lib/customer-error-messages";
import { logError } from "@/lib/logger";
import { parsePaymentMethodValue } from "@/lib/payment-labels";
import { CustomerError } from "@/modules/customers/customer.errors";
import { getBranchesForManagement } from "@/modules/branches/get-branches-for-management.use-case";
import {
  createCustomer,
  deleteCustomer,
  registerCustomerPayment,
  updateCustomer,
} from "@/modules/customers/customer.use-cases";
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

function taxCondition(value: string): TaxCondition | null {
  return (Object.values(TaxCondition) as string[]).includes(value) ? (value as TaxCondition) : null;
}

function readCustomer(formData: FormData) {
  return {
    name: text(formData, "name"),
    taxId: text(formData, "taxId") || null,
    taxCondition: taxCondition(text(formData, "taxCondition")),
    phone: text(formData, "phone") || null,
    email: text(formData, "email") || null,
    address: text(formData, "address") || null,
    notes: text(formData, "notes") || null,
    creditLimit: text(formData, "creditLimit") ? money(text(formData, "creditLimit")) : null,
    // Cumpleaños: solo se usan día y mes (ver marketing.logic.ts).
    birthday: parseDay(text(formData, "birthday")),
    active: formData.get("active") !== null,
  };
}

export async function createCustomerAction(formData: FormData) {
  const { session } = await requireModule(AppModule.CUSTOMERS);

  try {
    await createCustomer({ businessId: session.user.businessId, userId: session.user.id, ...readCustomer(formData) });
  } catch (error) {
    handle(error, "customer.create", session.user.businessId, session.user.id);
  }

  back("success", "Cliente creado.");
}

export async function updateCustomerAction(formData: FormData) {
  const { session } = await requireModule(AppModule.CUSTOMERS);
  const customerId = text(formData, "customerId");

  try {
    await updateCustomer(customerId, {
      businessId: session.user.businessId,
      userId: session.user.id,
      ...readCustomer(formData),
    });
  } catch (error) {
    handle(error, "customer.update", session.user.businessId, session.user.id, customerId);
  }

  back("success", "Cliente actualizado.", customerId);
}

export async function deleteCustomerAction(formData: FormData): Promise<CustomerActionResult> {
  const { session } = await requireModule(AppModule.CUSTOMERS);

  try {
    await deleteCustomer(text(formData, "customerId"), session.user.businessId, session.user.id);
  } catch (error) {
    return handleDelete(error, session.user.businessId, session.user.id);
  }

  return { ok: true, message: "Cliente eliminado." };
}

export type CustomerActionResult = { ok: boolean; message: string };

function handleDelete(error: unknown, businessId: string, userId: string): CustomerActionResult {
  if (error instanceof CustomerError) return { ok: false, message: getCustomerErrorMessageFor(error) };

  void logError("customer.delete", error, { businessId, userId });
  return { ok: false, message: "No pudimos completar la operación. Intentá de nuevo." };
}

// Cobro de fiado: entra plata de verdad, así que impacta en la caja de la sucursal.
export async function registerPaymentAction(formData: FormData) {
  const { session } = await requireModule(AppModule.CUSTOMERS);

  const customerId = text(formData, "customerId");
  const amount = money(text(formData, "amount"));
  const method = parsePaymentMethodValue(formData.get("method")) ?? PaymentMethod.CASH;
  const branchId = text(formData, "branchId") || null;

  if (!amount || amount <= 0) {
    back("error", "Ingresá un importe válido.", customerId);
  }

  // Multisucursal: un pago sin sucursal no aparece en la caja de NINGUNA
  // (findCustomerPaymentsByMethod filtra por branchId) y el arqueo quedaría
  // descuadrado sin error visible. El form manda la primera sucursal por
  // defecto; este guard defiende el flujo contra regresiones futuras.
  if (!branchId && (await getBranchesForManagement(session.user.businessId)).length > 1) {
    back("error", "Elegí la sucursal donde se cobró.", customerId);
  }

  try {
    await registerCustomerPayment({
      customerId,
      businessId: session.user.businessId,
      branchId,
      amount,
      method,
      note: text(formData, "note") || null,
      userId: session.user.id,
    });
  } catch (error) {
    handle(error, "customer.payment", session.user.businessId, session.user.id, customerId);
  }

  back("success", "Pago registrado.", customerId);
}

function handle(error: unknown, event: string, businessId: string, userId: string, customerId?: string): never {
  if (error instanceof CustomerError) {
    back("error", getCustomerErrorMessageFor(error), customerId);
  }

  void logError(event, error, { businessId, userId });
  back("error", "No pudimos completar la operación. Intentá de nuevo.", customerId);
}

function back(status: "success" | "error", message: string, customerId?: string): never {
  // La acción acabó de mutar datos y el redirect vuelve a la MISMA ruta: sin
  // invalidarla, el router del cliente puede servir el árbol que ya tenía y el
  // usuario ve el valor de antes (visto de verdad: un ajuste de stock a 50 que
  // seguía mostrando 111).
  revalidatePath("/customers");

  const params = new URLSearchParams({ status, message });
  if (customerId) params.set("customerId", customerId);
  redirect(`/customers?${params.toString()}`);
}

function parseDay(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}
