import {
  CustomerError,
  CustomerErrorCode,
  type CustomerErrorCode as CustomerErrorCodeType,
} from "@/modules/customers/customer.errors";

const customerErrorMessages: Record<CustomerErrorCodeType, string> = {
  [CustomerErrorCode.CUSTOMER_NOT_FOUND]: "No encontramos el cliente.",
  [CustomerErrorCode.INVALID_NAME]: "Ingresá el nombre del cliente.",
  [CustomerErrorCode.INVALID_TAX_ID]: "El CUIT/DNI no es válido.",
  [CustomerErrorCode.INVALID_AMOUNT]: "Ingresá un importe válido en pesos.",
  [CustomerErrorCode.INVALID_CREDIT_LIMIT]: "Ingresá un límite de crédito válido.",
  [CustomerErrorCode.CREDIT_LIMIT_EXCEEDED]: "El cliente se pasaría de su límite de crédito.",
  [CustomerErrorCode.CUSTOMER_INACTIVE]: "El cliente está inactivo: no se le puede fiar.",
  [CustomerErrorCode.NOTHING_TO_PAY]: "El cliente no tiene deuda pendiente.",
};

export function getCustomerErrorMessage(code: CustomerErrorCodeType) {
  return customerErrorMessages[code];
}

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export function getCustomerErrorMessageFor(error: CustomerError): string {
  if (error.code === CustomerErrorCode.CREDIT_LIMIT_EXCEEDED && error.detail) {
    const { balance = 0, creditLimit = 0, attempted = 0 } = error.detail;
    const excess = balance + attempted - creditLimit;

    return `Se pasa por ${money.format(excess)} del límite (debe ${money.format(balance)} de ${money.format(creditLimit)}).`;
  }

  return customerErrorMessages[error.code];
}
