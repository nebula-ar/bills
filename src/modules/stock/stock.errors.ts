export const StockErrorCode = {
  PRODUCT_NOT_FOUND: "PRODUCT_NOT_FOUND",
  PRODUCT_NOT_TRACKED: "PRODUCT_NOT_TRACKED",
  BRANCH_NOT_FOUND: "BRANCH_NOT_FOUND",
  INVALID_QUANTITY: "INVALID_QUANTITY",
  INVALID_COST: "INVALID_COST",
  SAME_BRANCH_TRANSFER: "SAME_BRANCH_TRANSFER",
  INSUFFICIENT_STOCK: "INSUFFICIENT_STOCK",
} as const;

export type StockErrorCode = (typeof StockErrorCode)[keyof typeof StockErrorCode];

export class StockError extends Error {
  constructor(
    public readonly code: StockErrorCode,
    // Datos para armar un mensaje concreto ("Quedan 3 kg de Tomate").
    public readonly detail?: { productName?: string; available?: number },
  ) {
    super(code);
    this.name = "StockError";
  }
}
