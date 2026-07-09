"use server";

import { requireAdminSession } from "@/lib/auth";
import { logError } from "@/lib/logger";
import { getServiceErrorMessage } from "@/lib/service-error-messages";
import { createGlobalBusinessService } from "@/modules/services/create-global-service.use-case";
import { ServiceError } from "@/modules/services/service.errors";
import { updateGlobalService } from "@/modules/services/update-global-service.use-case";
import { upsertBranchServiceConfiguration } from "@/modules/services/upsert-branch-service-config.use-case";
import { redirect } from "next/navigation";

const genericErrorMessage = "No pudimos guardar el servicio. Intentá de nuevo.";

export async function createService(formData: FormData) {
  const session = await requireAdminSession();

  const branchId = parseRequiredString(formData, "branchId");
  const name = parseRequiredString(formData, "name");
  const description = parseOptionalString(formData, "description");
  const priceRaw = formData.get("price");
  const price = parsePrice(priceRaw);
  const priceEntered = typeof priceRaw === "string" && priceRaw.trim().length > 0;

  if (!branchId || !name) {
    redirectWithMessage("error", "Completá el nombre del servicio.", branchId ?? undefined);
  }

  if (priceEntered && !price) {
    redirectWithMessage("error", "Poné un precio válido para la sucursal.", branchId);
  }

  try {
    const service = await createGlobalBusinessService({
      businessId: session.user.businessId,
      branchId,
      name,
      description,
    });

    if (price) {
      await upsertBranchServiceConfiguration({ businessId: session.user.businessId, branchId, serviceId: service.id, price, active: true });
    }
  } catch (error) {
    await handleServiceActionError(error, branchId, { businessId: session.user.businessId, userId: session.user.id });
  }

  redirectWithMessage(
    "success",
    price ? "Servicio creado y habilitado en la sucursal." : "Servicio creado en el catálogo.",
    branchId,
  );
}

export async function saveBranchServiceConfig(formData: FormData) {
  const session = await requireAdminSession();

  const branchId = parseRequiredString(formData, "branchId");
  const serviceId = parseRequiredString(formData, "serviceId");
  const price = parsePrice(formData.get("price"));
  const active = formData.get("active") === "on";

  if (!branchId || !serviceId || !price) {
    redirectWithMessage("error", "Completá un precio válido en pesos.", branchId ?? undefined);
  }

  try {
    await upsertBranchServiceConfiguration({
      businessId: session.user.businessId,
      branchId,
      serviceId,
      price,
      active,
    });
  } catch (error) {
    await handleServiceActionError(error, branchId, { businessId: session.user.businessId, userId: session.user.id });
  }

  redirectWithMessage("success", "Configuración de sucursal guardada.", branchId);
}

export async function updateService(formData: FormData) {
  const session = await requireAdminSession();

  const branchId = parseRequiredString(formData, "branchId");
  const serviceId = parseRequiredString(formData, "serviceId");
  const name = parseRequiredString(formData, "name");
  const description = parseOptionalString(formData, "description");
  const priceRaw = formData.get("price");
  const price = parsePrice(priceRaw);
  const configured = formData.get("configured") === "true";
  const active = formData.get("active") === "on";

  if (!branchId || !serviceId || !name) {
    redirectWithMessage("error", "Completá el nombre del servicio.", branchId ?? undefined);
  }

  const priceEntered = typeof priceRaw === "string" && priceRaw.trim().length > 0;
  const wantsConfig = configured || active || priceEntered;

  if (wantsConfig && !price) {
    redirectWithMessage("error", "Poné un precio válido para configurar o habilitar el servicio.", branchId);
  }

  try {
    await updateGlobalService({ businessId: session.user.businessId, serviceId, name, description });

    if (wantsConfig && price) {
      await upsertBranchServiceConfiguration({ businessId: session.user.businessId, branchId, serviceId, price, active });
    }
  } catch (error) {
    await handleServiceActionError(error, branchId, { businessId: session.user.businessId, userId: session.user.id });
  }

  redirectWithMessage("success", "Servicio actualizado.", branchId);
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

function parsePrice(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim().replace(",", ".");
  const price = Number(normalizedValue);

  return Number.isInteger(price) && price > 0 ? price : null;
}

async function handleServiceActionError(
  error: unknown,
  branchId: string | undefined,
  meta: { businessId: string; userId: string },
): Promise<never> {
  if (error instanceof ServiceError) {
    redirectWithMessage("error", getServiceErrorMessage(error.code), branchId);
  }

  await logError("service.save", error, { businessId: meta.businessId, userId: meta.userId, context: { branchId: branchId ?? null } });
  redirectWithMessage("error", genericErrorMessage, branchId);
}

function redirectWithMessage(status: "error" | "success", message: string, branchId?: string): never {
  const params = new URLSearchParams({ status, message });

  if (branchId) {
    params.set("branchId", branchId);
  }

  redirect(`/services?${params.toString()}`);
}
