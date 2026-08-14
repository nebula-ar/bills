import { AfipStatus, InvoiceType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// Condición frente a AFIP. Cambia qué se le pregunta al cargar una compra: un
// Responsable Inscripto recupera el IVA (es crédito fiscal, no costo), un
// monotributista no.
export async function findBusinessTaxCondition(businessId: string) {
  const business = await prisma.business.findFirst({
    where: { id: businessId, deleted: false },
    select: { taxCondition: true },
  });

  return business?.taxCondition ?? null;
}

export function findSaleForInvoicing(saleId: string, businessId: string) {
  return prisma.sale.findFirst({
    where: {
      id: saleId,
      deleted: false,
      branch: { businessId },
    },
    select: {
      id: true,
      total: true,
      customerName: true,
      customerTaxId: true,
      customerTaxCondition: true,
      // Para el guard de doble emisión (INVOICE_ALREADY_ISSUED).
      afipStatus: true,
    },
  });
}

export type MarkInvoiceIssuedInput = {
  saleId: string;
  invoiceType: InvoiceType;
  cae: string;
  caeVencimiento: Date;
  afipVoucherNumber: number;
};

export function markInvoiceIssued(input: MarkInvoiceIssuedInput) {
  return prisma.sale.update({
    where: { id: input.saleId },
    data: {
      afipStatus: AfipStatus.ISSUED,
      invoiceType: input.invoiceType,
      cae: input.cae,
      caeVencimiento: input.caeVencimiento,
      afipVoucherNumber: input.afipVoucherNumber,
      afipError: null,
    },
  });
}

export function markInvoiceFailed(saleId: string, invoiceType: InvoiceType | null, error: string) {
  return prisma.sale.update({
    where: { id: saleId },
    data: {
      afipStatus: AfipStatus.FAILED,
      invoiceType: invoiceType ?? undefined,
      afipError: error,
    },
  });
}

export function markInvoiceNotConfigured(saleId: string, error: string) {
  return prisma.sale.update({
    where: { id: saleId },
    data: {
      afipStatus: AfipStatus.NOT_CONFIGURED,
      afipError: error,
    },
  });
}
