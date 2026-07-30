export const ProductErrorCode = {
  BRANCH_NOT_FOUND: "BRANCH_NOT_FOUND",
  PRODUCT_NOT_FOUND: "PRODUCT_NOT_FOUND",
  PRODUCT_PRICE_NOT_FOUND: "PRODUCT_PRICE_NOT_FOUND",
  INVALID_PRODUCT_NAME: "INVALID_PRODUCT_NAME",
  INVALID_PRICE: "INVALID_PRICE",
  INVALID_COST: "INVALID_COST",
  INVALID_MIN_STOCK: "INVALID_MIN_STOCK",
  DUPLICATE_CODE: "DUPLICATE_CODE",
  INVALID_IMAGE: "INVALID_IMAGE",
  INVALID_IMAGE_TYPE: "INVALID_IMAGE_TYPE",
  IMAGE_TOO_LARGE: "IMAGE_TOO_LARGE",
  NO_VARIANTS: "NO_VARIANTS",
  TOO_MANY_VARIANTS: "TOO_MANY_VARIANTS",
} as const;

export type ProductErrorCode = (typeof ProductErrorCode)[keyof typeof ProductErrorCode];

export class ProductError extends Error {
  constructor(public readonly code: ProductErrorCode) {
    super(code);
    this.name = "ProductError";
  }
}
