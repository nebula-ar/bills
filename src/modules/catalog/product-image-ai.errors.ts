export const ProductImageAiErrorCode = {
  CONFIG_MISSING: "CONFIG_MISSING",
  INVALID_REQUEST: "INVALID_REQUEST",
  PRODUCT_NOT_FOUND: "PRODUCT_NOT_FOUND",
  SOURCE_IMAGE_REQUIRED: "SOURCE_IMAGE_REQUIRED",
  DAILY_LIMIT_REACHED: "DAILY_LIMIT_REACHED",
  GENERATION_IN_PROGRESS: "GENERATION_IN_PROGRESS",
  PROVIDER_AUTH: "PROVIDER_AUTH",
  PROVIDER_PAYMENT: "PROVIDER_PAYMENT",
  PROVIDER_RATE_LIMIT: "PROVIDER_RATE_LIMIT",
  PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  INVALID_PROVIDER_RESPONSE: "INVALID_PROVIDER_RESPONSE",
} as const;

export type ProductImageAiErrorCode = (typeof ProductImageAiErrorCode)[keyof typeof ProductImageAiErrorCode];

export class ProductImageAiError extends Error {
  constructor(
    public readonly code: ProductImageAiErrorCode,
    public readonly retryAfterSeconds?: number,
  ) {
    super(code);
    this.name = "ProductImageAiError";
  }
}
