import { prisma } from "@/lib/prisma";
import { TaxCondition } from "@/generated/prisma/client";

export type UpdateFiscalDataInput = {
  businessId: string;
  cuit: string | null;
  taxCondition: TaxCondition | null;
  salesPointNumber: number | null;
};

export type SaveCertificateInput = {
  businessId: string;
  cert: string;
  key: string;
  alias: string;
};

export function findBusinessFiscalData(businessId: string) {
  return prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      name: true,
      cuit: true,
      taxCondition: true,
      salesPointNumber: true,
      afipCertAlias: true,
      afipCertCreatedAt: true,
    },
  });
}

export function findBusinessForInvoicing(businessId: string) {
  return prisma.business.findUnique({
    where: { id: businessId },
    select: {
      cuit: true,
      taxCondition: true,
      salesPointNumber: true,
      afipCertEncrypted: true,
      afipKeyEncrypted: true,
    },
  });
}

export function updateBusinessFiscalData(input: UpdateFiscalDataInput) {
  return prisma.business.update({
    where: { id: input.businessId },
    data: {
      cuit: input.cuit,
      taxCondition: input.taxCondition,
      salesPointNumber: input.salesPointNumber,
    },
  });
}

export function saveBusinessCertificate(input: SaveCertificateInput) {
  return prisma.business.update({
    where: { id: input.businessId },
    data: {
      afipCertEncrypted: input.cert,
      afipKeyEncrypted: input.key,
      afipCertAlias: input.alias,
      afipCertCreatedAt: new Date(),
    },
  });
}
