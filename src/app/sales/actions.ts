"use server";

import { requireAdminSession } from "@/lib/auth";
import { getSaleErrorMessage } from "@/lib/sale-error-messages";
import { cancelSale } from "@/modules/sales/cancel-sale.use-case";
import { SaleError } from "@/modules/sales/sale.errors";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const genericErrorMessage = "No pudimos cancelar la venta. Intentá de nuevo.";

export async function cancelSaleAction(formData: FormData) {
  await requireAdminSession();

  const saleId = parseRequiredString(formData, "saleId");
  const reason = parseOptionalString(formData, "reason");

  if (!saleId) {
    redirectWithMessage("error", "No encontramos la venta para cancelar.");
  }

  try {
    await cancelSale({ saleId, reason });
  } catch (error) {
    if (error instanceof SaleError) {
      redirectWithMessage("error", getSaleErrorMessage(error.code));
    }

    console.error(error);
    redirectWithMessage("error", genericErrorMessage);
  }

  revalidatePath("/sales");
  revalidatePath("/");
  redirectWithMessage("success", "Venta cancelada correctamente.");
}

function parseRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function parseOptionalString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function redirectWithMessage(status: "error" | "success", message: string): never {
  const params = new URLSearchParams({ status, message });
  redirect(`/sales?${params.toString()}`);
}
