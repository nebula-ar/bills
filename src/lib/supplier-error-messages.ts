import {
  SupplierError,
  SupplierErrorCode,
  type SupplierErrorCode as SupplierErrorCodeType,
} from "@/modules/suppliers/supplier.errors";

const supplierErrorMessages: Record<SupplierErrorCodeType, string> = {
  [SupplierErrorCode.SUPPLIER_NOT_FOUND]: "No encontramos el proveedor.",
  [SupplierErrorCode.PURCHASE_NOT_FOUND]: "No encontramos la factura de compra.",
  [SupplierErrorCode.INVALID_NAME]: "Ingresá el nombre del proveedor.",
  [SupplierErrorCode.INVALID_TAX_ID]: "El CUIT del proveedor no es válido.",
  [SupplierErrorCode.EMPTY_ITEMS]: "Cargá al menos un ítem en la factura.",
  [SupplierErrorCode.INVALID_ITEM]: "Revisá la descripción, la cantidad y el costo de los ítems.",
  [SupplierErrorCode.INVALID_AMOUNT]: "Ingresá un importe válido en pesos.",
  [SupplierErrorCode.PAYMENT_EXCEEDS_PENDING]: "El pago supera lo que queda por pagar.",
  [SupplierErrorCode.CREDIT_EXCEEDS_PENDING]: "La nota de crédito supera lo que queda por pagar.",
  [SupplierErrorCode.INVALID_PAYMENT_METHOD]: "Elegí de qué cuenta sale la plata: a un proveedor no se le paga en cuenta corriente.",
  [SupplierErrorCode.PURCHASE_ALREADY_PAID]: "Esa factura ya está saldada.",
  [SupplierErrorCode.PURCHASE_CANCELLED]: "Esa factura está anulada.",
  [SupplierErrorCode.BRANCH_REQUIRED_FOR_STOCK]: "Elegí la sucursal donde entra la mercadería.",
};

export function getSupplierErrorMessage(code: SupplierErrorCodeType) {
  return supplierErrorMessages[code];
}

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export function getSupplierErrorMessageFor(error: SupplierError): string {
  if (error.code === SupplierErrorCode.PAYMENT_EXCEEDS_PENDING && error.detail?.pending !== undefined) {
    return `Solo quedan ${money.format(error.detail.pending)} por pagar.`;
  }

  if (error.code === SupplierErrorCode.CREDIT_EXCEEDS_PENDING && error.detail?.pending !== undefined) {
    return `Solo quedan ${money.format(error.detail.pending)} por saldar de esa factura.`;
  }

  return supplierErrorMessages[error.code];
}
