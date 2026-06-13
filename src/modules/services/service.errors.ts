export const ServiceErrorCode = {
  BRANCH_NOT_FOUND: "BRANCH_NOT_FOUND",
  SERVICE_NOT_FOUND: "SERVICE_NOT_FOUND",
  SERVICE_PRICE_NOT_FOUND: "SERVICE_PRICE_NOT_FOUND",
  INVALID_SERVICE_NAME: "INVALID_SERVICE_NAME",
  INVALID_PRICE: "INVALID_PRICE",
} as const;

export type ServiceErrorCode = (typeof ServiceErrorCode)[keyof typeof ServiceErrorCode];

export class ServiceError extends Error {
  constructor(public readonly code: ServiceErrorCode) {
    super(code);
    this.name = "ServiceError";
  }
}
