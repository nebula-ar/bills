"use server";

import { requireAdminSession } from "@/lib/auth";
import { getBarberErrorMessage } from "@/lib/barber-error-messages";
import { logError } from "@/lib/logger";
import { BarberError } from "@/modules/barbers/barber.errors";
import { createBarberForManagement } from "@/modules/barbers/create-barber.use-case";
import { updateBarberForManagement } from "@/modules/barbers/update-barber.use-case";
import { redirect } from "next/navigation";

const genericErrorMessage = "No pudimos guardar el barbero. Intentá de nuevo.";

export async function createBarber(formData: FormData) {
  const session = await requireAdminSession();

  const name = parseRequiredString(formData, "name");
  const branchId = parseRequiredString(formData, "branchId");
  const pin = parseRequiredString(formData, "pin");
  const canCloseCash = formData.get("canCloseCash") === "on";

  if (!name || !branchId || !pin) {
    redirectWithMessage("error", "Completá nombre, sucursal y PIN del barbero.");
  }

  try {
    await createBarberForManagement({ businessId: session.user.businessId, name, branchId, pin, canCloseCash });
  } catch (error) {
    if (error instanceof BarberError) {
      redirectWithMessage("error", getBarberErrorMessage(error.code));
    }

    await logError("barber.create", error, { businessId: session.user.businessId, userId: session.user.id });
    redirectWithMessage("error", genericErrorMessage);
  }

  redirectWithMessage("success", "Barbero creado.");
}

export async function updateBarber(formData: FormData) {
  const session = await requireAdminSession();

  const barberId = parseRequiredString(formData, "barberId");
  const name = parseRequiredString(formData, "name");
  const branchId = parseRequiredString(formData, "branchId");
  const pin = parseOptionalString(formData, "pin");
  const active = formData.get("active") === "on";
  const canCloseCash = formData.get("canCloseCash") === "on";

  if (!barberId || !name || !branchId) {
    redirectWithMessage("error", "Completá nombre y sucursal del barbero.");
  }

  try {
    await updateBarberForManagement({ businessId: session.user.businessId, barberId, name, branchId, active, canCloseCash, pin });
  } catch (error) {
    if (error instanceof BarberError) {
      redirectWithMessage("error", getBarberErrorMessage(error.code));
    }

    await logError("barber.update", error, { businessId: session.user.businessId, userId: session.user.id });
    redirectWithMessage("error", genericErrorMessage);
  }

  redirectWithMessage("success", "Barbero actualizado.");
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

  return value.trim();
}

function redirectWithMessage(status: "error" | "success", message: string): never {
  const params = new URLSearchParams({ status, message });
  redirect(`/barbers?${params.toString()}`);
}
