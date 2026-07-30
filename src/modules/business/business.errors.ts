export const BusinessErrorCode = {
  BUSINESS_NOT_FOUND: "BUSINESS_NOT_FOUND",
  CUIT_INVALID: "CUIT_INVALID",
  FISCAL_DATA_INCOMPLETE: "FISCAL_DATA_INCOMPLETE",
  AFIP_TOKEN_MISSING: "AFIP_TOKEN_MISSING",
} as const;

export type BusinessErrorCode = (typeof BusinessErrorCode)[keyof typeof BusinessErrorCode];

export class BusinessError extends Error {
  constructor(public readonly code: BusinessErrorCode) {
    super(code);
    this.name = "BusinessError";
  }
}
