"use server";

import { requireAdminSession } from "@/lib/auth";
import { getBranchErrorMessage } from "@/lib/branch-error-messages";
import { BranchError } from "@/modules/branches/branch.errors";
import { createBranchForManagement } from "@/modules/branches/create-branch.use-case";
import { updateBranchForManagement } from "@/modules/branches/update-branch.use-case";
import { redirect } from "next/navigation";

const genericErrorMessage = "No pudimos guardar la sucursal. Intentá de nuevo.";

export async function createBranch(formData: FormData) {
  await requireAdminSession();

  const name = parseRequiredString(formData, "name");
  const address = parseOptionalString(formData, "address");

  if (!name) {
    redirectWithMessage("error", "Completá el nombre de la sucursal.");
  }

  try {
    await createBranchForManagement({ name, address });
  } catch (error) {
    handleBranchActionError(error);
  }

  redirectWithMessage("success", "Sucursal creada.");
}

export async function updateBranch(formData: FormData) {
  await requireAdminSession();

  const branchId = parseRequiredString(formData, "branchId");
  const name = parseRequiredString(formData, "name");
  const address = parseOptionalString(formData, "address");
  const active = formData.get("active") === "on";

  if (!branchId || !name) {
    redirectWithMessage("error", "Completá el nombre de la sucursal.");
  }

  try {
    await updateBranchForManagement({ branchId, name, address, active });
  } catch (error) {
    handleBranchActionError(error);
  }

  redirectWithMessage("success", "Sucursal actualizada.");
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

function handleBranchActionError(error: unknown): never {
  if (error instanceof BranchError) {
    redirectWithMessage("error", getBranchErrorMessage(error.code));
  }

  console.error(error);
  redirectWithMessage("error", genericErrorMessage);
}

function redirectWithMessage(status: "error" | "success", message: string): never {
  const params = new URLSearchParams({ status, message });
  redirect(`/branches?${params.toString()}`);
}
