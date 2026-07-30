"use server";

import { TaxCondition } from "@/generated/prisma/client";
import { requireAdminSession } from "@/lib/auth";
import { getBusinessErrorMessage } from "@/lib/business-error-messages";
import { logError } from "@/lib/logger";
import { BusinessError } from "@/modules/business/business.errors";
import { requestProductionCertificate } from "@/modules/business/request-production-certificate.use-case";
import { updateFiscalDataForManagement } from "@/modules/business/update-business-fiscal-data.use-case";
import { redirect } from "next/navigation";

const genericErrorMessage = "No pudimos guardar los datos fiscales. Intentá de nuevo.";
const certificateGenericError = "No pudimos generar el certificado. Intentá de nuevo.";

export async function updateFiscalData(formData: FormData) {
  const session = await requireAdminSession();

  const cuit = parseOptionalString(formData, "cuit");
  const taxCondition = parseTaxCondition(formData.get("taxCondition"));
  const salesPointNumber = parseOptionalInt(formData, "salesPointNumber");

  let result: { fiscallyConfigured: boolean };

  try {
    result = await updateFiscalDataForManagement({
      businessId: session.user.businessId,
      cuit,
      taxCondition,
      salesPointNumber,
    });
  } catch (error) {
    if (error instanceof BusinessError) {
      redirectWithMessage("error", getBusinessErrorMessage(error.code));
    }

    await logError("business.fiscal-data.save", error, { businessId: session.user.businessId, userId: session.user.id });
    redirectWithMessage("error", genericErrorMessage);
  }

  if (result.fiscallyConfigured) {
    redirectWithMessage("success", "Datos fiscales guardados. Ya podés generar el certificado y facturar.");
  }

  const missing = [
    !cuit ? "el CUIT" : null,
    !taxCondition ? "la condición frente al IVA" : null,
    !salesPointNumber ? "el punto de venta" : null,
  ].filter((field): field is string => field !== null);

  redirectWithMessage("error", `Se guardó, pero todavía falta completar ${joinWithY(missing)} para poder facturar.`);
}

function joinWithY(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

export async function generateCertificate(formData: FormData) {
  const session = await requireAdminSession();

  const claveFiscalUsername = parseRequiredString(formData, "claveFiscalUsername");
  const claveFiscalPassword = parseRequiredString(formData, "claveFiscalPassword");

  if (!claveFiscalUsername || !claveFiscalPassword) {
    redirectWithMessage("error", "Completá el usuario y la contraseña de Clave Fiscal.");
  }

  try {
    await requestProductionCertificate({
      businessId: session.user.businessId,
      claveFiscalUsername,
      claveFiscalPassword,
    });
  } catch (error) {
    if (error instanceof BusinessError) {
      redirectWithMessage("error", getBusinessErrorMessage(error.code));
    }

    const message = error instanceof Error ? error.message : certificateGenericError;
    await logError("business.afip-certificate.generate", error, { businessId: session.user.businessId, userId: session.user.id });
    redirectWithMessage("error", message);
  }

  redirectWithMessage("success", "Certificado de producción generado. Ya podés facturar de verdad.");
}

function parseRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function parseOptionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function parseOptionalInt(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function parseTaxCondition(value: FormDataEntryValue | null): TaxCondition | null {
  if (typeof value !== "string") return null;
  return value in TaxCondition ? (value as TaxCondition) : null;
}

function redirectWithMessage(status: "error" | "success", message: string): never {
  const params = new URLSearchParams({ status, message });
  redirect(`/facturacion?${params.toString()}`);
}
