export const CustomerErrorCode = {
  CUSTOMER_NOT_FOUND: "CUSTOMER_NOT_FOUND",
  INVALID_NAME: "INVALID_NAME",
  INVALID_TAX_ID: "INVALID_TAX_ID",
  INVALID_AMOUNT: "INVALID_AMOUNT",
  INVALID_CREDIT_LIMIT: "INVALID_CREDIT_LIMIT",
  CREDIT_LIMIT_EXCEEDED: "CREDIT_LIMIT_EXCEEDED",
  CUSTOMER_INACTIVE: "CUSTOMER_INACTIVE",
  NOTHING_TO_PAY: "NOTHING_TO_PAY",
} as const;

export type CustomerErrorCode = (typeof CustomerErrorCode)[keyof typeof CustomerErrorCode];

export class CustomerError extends Error {
  constructor(
    public readonly code: CustomerErrorCode,
    // Para poder decir "se pasa por $4.500 del límite" en vez de un error genérico.
    public readonly detail?: { balance?: number; creditLimit?: number; attempted?: number },
  ) {
    super(code);
    this.name = "CustomerError";
  }
}
