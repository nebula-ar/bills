export const SaleErrorCode = {
  BRANCH_NOT_FOUND: "BRANCH_NOT_FOUND",
  STAFF_NOT_AVAILABLE: "STAFF_NOT_AVAILABLE",
  STAFF_INVALID_ROLE: "STAFF_INVALID_ROLE",
  STAFF_WRONG_BRANCH: "STAFF_WRONG_BRANCH",
  EMPTY_ITEMS: "EMPTY_ITEMS",
  EMPTY_PAYMENTS: "EMPTY_PAYMENTS",
  INVALID_ITEM_QUANTITY: "INVALID_ITEM_QUANTITY",
  INVALID_PAYMENT_AMOUNT: "INVALID_PAYMENT_AMOUNT",
  INVALID_MANUAL_EXTRA_DESCRIPTION: "INVALID_MANUAL_EXTRA_DESCRIPTION",
  INVALID_MANUAL_EXTRA_PRICE: "INVALID_MANUAL_EXTRA_PRICE",
  PRODUCT_NOT_AVAILABLE: "PRODUCT_NOT_AVAILABLE",
  PAYMENTS_TOTAL_MISMATCH: "PAYMENTS_TOTAL_MISMATCH",
  SALE_NOT_FOUND: "SALE_NOT_FOUND",
  SALE_ALREADY_CANCELLED: "SALE_ALREADY_CANCELLED",
  // La venta ya tiene un comprobante AFIP/ARCA emitido: anularla dejaría la
  // factura viva sobre una venta cancelada. Anular ese comprobante requeriría
  // una nota de crédito, que hoy no existe.
  SALE_HAS_ISSUED_INVOICE: "SALE_HAS_ISSUED_INVOICE",
  INVALID_CUSTOMER_TAX_ID: "INVALID_CUSTOMER_TAX_ID",
  // Stock
  INSUFFICIENT_STOCK: "INSUFFICIENT_STOCK",
  // Cuenta corriente
  ACCOUNT_REQUIRES_CUSTOMER: "ACCOUNT_REQUIRES_CUSTOMER",
  FRACTIONAL_QUANTITY_NOT_ALLOWED: "FRACTIONAL_QUANTITY_NOT_ALLOWED",
} as const;

export type SaleErrorCode = (typeof SaleErrorCode)[keyof typeof SaleErrorCode];

export class SaleError extends Error {
  constructor(
    public readonly code: SaleErrorCode,
    // Contexto para armar un mensaje concreto ("Quedan 2 kg de Tomate").
    public readonly detail?: { productName?: string; available?: number; requested?: number },
  ) {
    super(code);
    this.name = "SaleError";
  }
}
