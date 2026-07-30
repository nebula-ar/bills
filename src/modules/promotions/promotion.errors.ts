export const PromotionErrorCode = {
  PROMOTION_NOT_FOUND: "PROMOTION_NOT_FOUND",
  INVALID_NAME: "INVALID_NAME",
  INVALID_PERCENT: "INVALID_PERCENT",
  INVALID_AMOUNT: "INVALID_AMOUNT",
  INVALID_NX_M: "INVALID_NX_M",
  INVALID_BUNDLE: "INVALID_BUNDLE",
  BUNDLE_NEEDS_PRODUCTS: "BUNDLE_NEEDS_PRODUCTS",
  SCOPE_NEEDS_TARGETS: "SCOPE_NEEDS_TARGETS",
  INVALID_DATE_RANGE: "INVALID_DATE_RANGE",
} as const;

export type PromotionErrorCode = (typeof PromotionErrorCode)[keyof typeof PromotionErrorCode];

export class PromotionError extends Error {
  constructor(public readonly code: PromotionErrorCode) {
    super(code);
    this.name = "PromotionError";
  }
}
