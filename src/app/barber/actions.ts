"use server";

import { getBarberErrorMessage } from "@/lib/barber-error-messages";
import { getSaleErrorMessage } from "@/lib/sale-error-messages";
import { parsePaymentMethod, parseRequiredString, parseSaleItemsFromFormData } from "@/lib/sale-form-parser";
import { BarberError } from "@/modules/barbers/barber.errors";
import { validateBarberPin } from "@/modules/barbers/validate-barber-pin.use-case";
import { createSimpleSale } from "@/modules/sales/create-simple-sale.use-case";
import { SaleError } from "@/modules/sales/sale.errors";
import { redirect } from "next/navigation";

const genericErrorMessage = "No pudimos registrar la venta. Intentá de nuevo.";

export async function registerBarberSale(formData: FormData) {
  const branchId = parseRequiredString(formData, "branchId");
  const barberId = parseRequiredString(formData, "barberId");
  const pin = parseRequiredString(formData, "pin");
  const parsedItems = parseSaleItemsFromFormData(formData);
  const paymentMethod = parsePaymentMethod(formData.get("paymentMethod"));
  // En una terminal personal (teléfono del barbero) el barbero viene fijado por el link.
  const lockedBarberId = formData.get("terminalLocked") === "1" ? barberId : null;

  if (parsedItems.error) {
    redirectWithMessage("error", parsedItems.error, branchId, lockedBarberId);
  }

  if (!branchId || !barberId || !pin || !paymentMethod) {
    redirectWithMessage("error", "Completá todos los campos para registrar la venta.", branchId, lockedBarberId);
  }

  try {
    await validateBarberPin({
      branchId,
      barberId,
      pin,
    });

    await createSimpleSale({
      branchId,
      barberId,
      items: parsedItems.items,
      paymentMethod,
    });
  } catch (error) {
    if (error instanceof BarberError) {
      redirectWithMessage("error", getBarberErrorMessage(error.code), branchId, lockedBarberId);
    }

    if (error instanceof SaleError) {
      redirectWithMessage("error", getSaleErrorMessage(error.code), branchId, lockedBarberId);
    }

    console.error(error);
    redirectWithMessage("error", genericErrorMessage, branchId, lockedBarberId);
  }

  redirectWithMessage("success", "Venta registrada correctamente.", branchId, lockedBarberId);
}

function redirectWithMessage(
  status: "error" | "success",
  message: string,
  branchId?: string | null,
  barberId?: string | null,
): never {
  const params = new URLSearchParams({ status, message });

  if (branchId) {
    params.set("branch", branchId);
  }

  if (barberId) {
    params.set("barber", barberId);
  }

  redirect(`/barber?${params.toString()}`);
}
