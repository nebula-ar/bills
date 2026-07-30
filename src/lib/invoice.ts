// Lógica pura de facturación AFIP/ARCA. Sin DB ni red: se testea con Vitest.
// La emisión real (llamada a AfipSDK) vive en invoice-provider.ts.

import { InvoiceType, TaxCondition } from "@/generated/prisma/enums";

export type BusinessFiscalData = {
  cuit: string | null;
  taxCondition: TaxCondition | null;
  salesPointNumber: number | null;
};

/** ¿El negocio tiene los tres datos fiscales cargados? */
export function isBusinessFiscallyConfigured(business: BusinessFiscalData): boolean {
  return !!business.cuit && !!business.taxCondition && business.salesPointNumber != null;
}

/**
 * Determina el tipo de comprobante según la condición de IVA del emisor y del
 * cliente. Regla simplificada (sujeta a validación contable real):
 * - Emisor sin configurar → null (no se puede facturar).
 * - Emisor Monotributo o Exento → siempre C.
 * - Emisor Responsable Inscripto → A si el cliente también es RI, si no B.
 */
export function determineInvoiceType(
  businessTaxCondition: TaxCondition | null,
  customerTaxCondition: TaxCondition,
): InvoiceType | null {
  if (!businessTaxCondition) return null;
  if (businessTaxCondition === TaxCondition.MONOTRIBUTO || businessTaxCondition === TaxCondition.EXENTO) {
    return InvoiceType.C;
  }
  if (businessTaxCondition === TaxCondition.RESPONSABLE_INSCRIPTO) {
    return customerTaxCondition === TaxCondition.RESPONSABLE_INSCRIPTO ? InvoiceType.A : InvoiceType.B;
  }
  return null;
}

// CbteTipo — estables desde hace más de una década (WS spec 4.4). Compartido
// entre invoice-provider.ts (emisión real) y afip-qr.ts (QR del ticket).
export const INVOICE_TYPE_CODES: Record<InvoiceType, number> = {
  [InvoiceType.A]: 1,
  [InvoiceType.B]: 6,
  [InvoiceType.C]: 11,
};
