"use server";

import { requireAdminSession } from "@/lib/auth";
import { getBarberErrorMessage } from "@/lib/barber-error-messages";
import { BarberError } from "@/modules/barbers/barber.errors";
import { updateBarberPin } from "@/modules/barbers/update-barber-pin.use-case";
import { redirect } from "next/navigation";

const genericErrorMessage = "No pudimos guardar el PIN. Intentá de nuevo.";

export async function saveBarberPin(formData: FormData) {
  await requireAdminSession();

  const barberId = parseRequiredString(formData, "barberId");
  const pin = parseRequiredString(formData, "pin");

  if (!barberId || !pin) {
    redirectWithMessage("error", "Completá el PIN del barbero.");
  }

  try {
    await updateBarberPin({ barberId, pin });
  } catch (error) {
    if (error instanceof BarberError) {
      redirectWithMessage("error", getBarberErrorMessage(error.code));
    }

    console.error(error);
    redirectWithMessage("error", genericErrorMessage);
  }

  redirectWithMessage("success", "PIN del barbero actualizado.");
}

function parseRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function redirectWithMessage(status: "error" | "success", message: string): never {
  const params = new URLSearchParams({ status, message });
  redirect(`/barbers?${params.toString()}`);
}
