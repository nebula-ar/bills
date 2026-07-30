import { TaxCondition } from "@/generated/prisma/client";
import { isBusinessFiscallyConfigured } from "@/lib/invoice";
import { validateTaxId } from "@/lib/tax-id";

import { BusinessError, BusinessErrorCode } from "./business.errors";
import { updateBusinessFiscalData } from "./business.repository";

export type UpdateFiscalDataForManagementInput = {
  businessId: string;
  cuit?: string | null;
  taxCondition?: TaxCondition | null;
  salesPointNumber?: number | null;
};

export type UpdateFiscalDataForManagementResult = { fiscallyConfigured: boolean };

export async function updateFiscalDataForManagement(
  input: UpdateFiscalDataForManagementInput,
): Promise<UpdateFiscalDataForManagementResult> {
  const cuit = normalizeCuit(input.cuit);

  if (cuit) {
    const check = validateTaxId(cuit);
    if (!check.valid || check.kind !== "CUIT") {
      throw new BusinessError(BusinessErrorCode.CUIT_INVALID);
    }
  }

  const taxCondition = input.taxCondition ?? null;
  const salesPointNumber = input.salesPointNumber ?? null;

  await updateBusinessFiscalData({
    businessId: input.businessId,
    cuit,
    taxCondition,
    salesPointNumber,
  });

  return { fiscallyConfigured: isBusinessFiscallyConfigured({ cuit, taxCondition, salesPointNumber }) };
}

function normalizeCuit(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}
