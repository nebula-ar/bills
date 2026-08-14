import { InvoicingErrorCode } from "@/modules/invoicing/invoicing.errors";

const invoicingErrorMessages: Record<InvoicingErrorCode, string> = {
  [InvoicingErrorCode.SALE_NOT_FOUND]: "No encontramos esa venta para facturar.",
  [InvoicingErrorCode.FISCAL_DATA_INCOMPLETE]: "Completá los datos fiscales del negocio antes de facturar.",
  [InvoicingErrorCode.INVOICE_TYPE_UNRESOLVED]: "No se pudo determinar el tipo de comprobante a emitir.",
  [InvoicingErrorCode.INVOICE_ALREADY_ISSUED]: "La venta ya tiene un comprobante emitido.",
};

export function getInvoicingErrorMessage(code: InvoicingErrorCode) {
  return invoicingErrorMessages[code];
}
