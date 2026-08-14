export const InvoicingErrorCode = {
  SALE_NOT_FOUND: "SALE_NOT_FOUND",
  FISCAL_DATA_INCOMPLETE: "FISCAL_DATA_INCOMPLETE",
  INVOICE_TYPE_UNRESOLVED: "INVOICE_TYPE_UNRESOLVED",
  // La venta ya tiene un CAE emitido: re-emitir crearía un comprobante duplicado.
  INVOICE_ALREADY_ISSUED: "INVOICE_ALREADY_ISSUED",
} as const;

export type InvoicingErrorCode = (typeof InvoicingErrorCode)[keyof typeof InvoicingErrorCode];

export class InvoicingError extends Error {
  constructor(public readonly code: InvoicingErrorCode) {
    super(code);
    this.name = "InvoicingError";
  }
}
