"use server";

import { PaymentMethod } from "@/generated/prisma/client";
import { requireAdminSession } from "@/lib/auth";
import { createSimpleSale } from "@/modules/sales/create-simple-sale.use-case";
import { SaleError } from "@/modules/sales/sale.errors";
import { redirect } from "next/navigation";

import { getSaleErrorMessage } from "./sale-error-messages";

const genericErrorMessage = "No pudimos registrar la venta. Intentá de nuevo.";

export async function registerSale(formData: FormData) {
  await requireAdminSession();

  const branchId = parseRequiredString(formData, "branchId");
  const barberId = parseRequiredString(formData, "barberId");
  const servicePriceId = parseRequiredString(formData, "servicePriceId");
  const quantity = parseQuantity(formData.get("quantity"));
  const paymentMethod = parsePaymentMethod(formData.get("paymentMethod"));

  if (!branchId || !barberId || !servicePriceId || !quantity || !paymentMethod) {
    redirectWithMessage("error", "Completá todos los campos para registrar la venta.");
  }

  try {
    await createSimpleSale({
      branchId,
      barberId,
      servicePriceId,
      quantity,
      paymentMethod,
    });
  } catch (error) {
    if (error instanceof SaleError) {
      redirectWithMessage("error", getSaleErrorMessage(error.code));
    }

    console.error(error);
    redirectWithMessage("error", genericErrorMessage);
  }

  redirectWithMessage("success", "Venta registrada correctamente.");
}

function parseRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function parseQuantity(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const quantity = Number(value);
  return Number.isInteger(quantity) && quantity > 0 ? quantity : null;
}

function parsePaymentMethod(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const methods = Object.values(PaymentMethod);
  return methods.includes(value as PaymentMethod) ? (value as PaymentMethod) : null;
}

function redirectWithMessage(status: "error" | "success", message: string): never {
  const params = new URLSearchParams({ status, message });
  redirect(`/sales/new?${params.toString()}`);
}
