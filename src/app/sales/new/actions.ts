"use server";

import { requireAdminSession } from "@/lib/auth";
import { getSaleErrorMessage } from "@/lib/sale-error-messages";
import { parsePaymentMethod, parseRequiredString, parseSaleItemsFromFormData } from "@/lib/sale-form-parser";
import { createSimpleSale } from "@/modules/sales/create-simple-sale.use-case";
import { SaleError } from "@/modules/sales/sale.errors";
import { redirect } from "next/navigation";

const genericErrorMessage = "No pudimos registrar la venta. Intentá de nuevo.";

export async function registerSale(formData: FormData) {
  await requireAdminSession();

  const branchId = parseRequiredString(formData, "branchId");
  const barberId = parseRequiredString(formData, "barberId");
  const parsedItems = parseSaleItemsFromFormData(formData);
  const paymentMethod = parsePaymentMethod(formData.get("paymentMethod"));

  if (parsedItems.error) {
    redirectWithMessage("error", parsedItems.error);
  }

  if (!branchId || !barberId || !paymentMethod) {
    redirectWithMessage("error", "Completá todos los campos para registrar la venta.");
  }

  try {
    await createSimpleSale({
      branchId,
      barberId,
      items: parsedItems.items,
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

function redirectWithMessage(status: "error" | "success", message: string): never {
  const params = new URLSearchParams({ status, message });
  redirect(`/sales/new?${params.toString()}`);
}
