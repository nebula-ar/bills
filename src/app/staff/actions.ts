"use server";

import { requireBusinessContext } from "@/lib/business-context";
import { getStaffErrorMessage } from "@/lib/staff-error-messages";
import { logError } from "@/lib/logger";
import { StaffError } from "@/modules/staff/staff.errors";
import { createStaffForManagement } from "@/modules/staff/create-staff.use-case";
import { updateStaffForManagement } from "@/modules/staff/update-staff.use-case";
import { redirect } from "next/navigation";

const genericErrorMessage = "No pudimos guardar el empleado. Intentá de nuevo.";

export async function createStaff(formData: FormData) {
  const { session, business } = await requireBusinessContext();

  const name = parseRequiredString(formData, "name");
  const branchId = parseRequiredString(formData, "branchId");
  const pin = parseRequiredString(formData, "pin");
  const canCloseCash = formData.get("canCloseCash") === "on";
  const commissionRate = parseCommissionRate(formData.get("commissionRate"));

  if (!name || !branchId || !pin) {
    redirectWithMessage("error", "Completá nombre, sucursal y PIN del empleado.");
  }

  try {
    await createStaffForManagement({ businessId: session.user.businessId, name, branchId, pin, canCloseCash });
  } catch (error) {
    if (error instanceof StaffError) {
      redirectWithMessage("error", getStaffErrorMessage(error.code));
    }

    await logError("staff.create", error, { businessId: session.user.businessId, userId: session.user.id });
    redirectWithMessage("error", genericErrorMessage);
  }

  redirectWithMessage("success", `${business.labels.staffSingular} creado.`);
}

export async function updateStaff(formData: FormData) {
  const { session, business } = await requireBusinessContext();

  const staffId = parseRequiredString(formData, "staffId");
  const name = parseRequiredString(formData, "name");
  const branchId = parseRequiredString(formData, "branchId");
  const pin = parseOptionalString(formData, "pin");
  const active = formData.get("active") === "on";
  const canCloseCash = formData.get("canCloseCash") === "on";
  const commissionRate = parseCommissionRate(formData.get("commissionRate"));

  if (!staffId || !name || !branchId) {
    redirectWithMessage("error", "Completá nombre y sucursal del empleado.");
  }

  try {
    await updateStaffForManagement({ businessId: session.user.businessId, staffId, name, branchId, active, canCloseCash, pin, commissionRate });
  } catch (error) {
    if (error instanceof StaffError) {
      redirectWithMessage("error", getStaffErrorMessage(error.code));
    }

    await logError("staff.update", error, { businessId: session.user.businessId, userId: session.user.id });
    redirectWithMessage("error", genericErrorMessage);
  }

  redirectWithMessage("success", `${business.labels.staffSingular} actualizado.`);
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
  redirect(`/staff?${params.toString()}`);
}

// El porcentaje se acota a 0-100: cargar 150% pagaría más de lo que entró.
function parseCommissionRate(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  const parsed = Number(value.replace(",", "."));

  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }

  return Math.min(Math.round(parsed), 100);
}
