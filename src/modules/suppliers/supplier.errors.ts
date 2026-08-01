export const SupplierErrorCode = {
  SUPPLIER_NOT_FOUND: "SUPPLIER_NOT_FOUND",
  PURCHASE_NOT_FOUND: "PURCHASE_NOT_FOUND",
  INVALID_NAME: "INVALID_NAME",
  INVALID_TAX_ID: "INVALID_TAX_ID",
  EMPTY_ITEMS: "EMPTY_ITEMS",
  INVALID_ITEM: "INVALID_ITEM",
  INVALID_AMOUNT: "INVALID_AMOUNT",
  PAYMENT_EXCEEDS_PENDING: "PAYMENT_EXCEEDS_PENDING",
  CREDIT_EXCEEDS_PENDING: "CREDIT_EXCEEDS_PENDING",
  INVALID_PAYMENT_METHOD: "INVALID_PAYMENT_METHOD",
  PURCHASE_ALREADY_PAID: "PURCHASE_ALREADY_PAID",
  PURCHASE_CANCELLED: "PURCHASE_CANCELLED",
  BRANCH_REQUIRED_FOR_STOCK: "BRANCH_REQUIRED_FOR_STOCK",
} as const;

export type SupplierErrorCode = (typeof SupplierErrorCode)[keyof typeof SupplierErrorCode];

export class SupplierError extends Error {
  constructor(
    public readonly code: SupplierErrorCode,
    public readonly detail?: { pending?: number; attempted?: number },
  ) {
    super(code);
    this.name = "SupplierError";
  }
}
