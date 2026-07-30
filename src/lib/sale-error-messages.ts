import { formatQuantity } from "@/lib/quantity";
import { SaleError, SaleErrorCode, type SaleErrorCode as SaleErrorCodeType } from "@/modules/sales/sale.errors";

// Mensajes neutros de rubro: acá no sabemos si el negocio vende cortes de pelo
// o tomates, así que hablamos de "ítem" y "producto" en vez de "servicio".
const saleErrorMessages: Record<SaleErrorCodeType, string> = {
  [SaleErrorCode.BRANCH_NOT_FOUND]: "No encontramos la sucursal seleccionada.",
  [SaleErrorCode.STAFF_NOT_AVAILABLE]: "La persona seleccionada no está disponible.",
  [SaleErrorCode.STAFF_INVALID_ROLE]: "La persona seleccionada no puede registrar ventas.",
  [SaleErrorCode.STAFF_WRONG_BRANCH]: "La persona seleccionada no pertenece a esta sucursal.",
  [SaleErrorCode.EMPTY_ITEMS]: "Agregá al menos un ítem a la venta.",
  [SaleErrorCode.EMPTY_PAYMENTS]: "Seleccioná un método de pago.",
  [SaleErrorCode.INVALID_ITEM_QUANTITY]: "La cantidad debe ser mayor a cero.",
  [SaleErrorCode.INVALID_PAYMENT_AMOUNT]: "El importe del pago debe ser mayor a cero.",
  [SaleErrorCode.INVALID_MANUAL_EXTRA_DESCRIPTION]: "Ingresá una descripción para el ítem suelto.",
  [SaleErrorCode.INVALID_MANUAL_EXTRA_PRICE]: "Ingresá un precio válido para el ítem suelto.",
  [SaleErrorCode.PRODUCT_NOT_AVAILABLE]: "El ítem seleccionado no está disponible en esta sucursal.",
  [SaleErrorCode.PAYMENTS_TOTAL_MISMATCH]: "El importe del pago no coincide con el total de la venta.",
  [SaleErrorCode.SALE_NOT_FOUND]: "No encontramos la venta o ya no está disponible.",
  [SaleErrorCode.SALE_ALREADY_CANCELLED]: "La venta ya estaba cancelada.",
  [SaleErrorCode.INVALID_CUSTOMER_TAX_ID]: "El CUIT/DNI del cliente no es válido.",
  [SaleErrorCode.INSUFFICIENT_STOCK]: "No hay stock suficiente para completar la venta.",
  [SaleErrorCode.ACCOUNT_REQUIRES_CUSTOMER]: "Para cobrar en cuenta corriente elegí un cliente.",
  [SaleErrorCode.FRACTIONAL_QUANTITY_NOT_ALLOWED]: "Ese ítem se vende por unidades enteras.",
};

export function getSaleErrorMessage(code: SaleErrorCodeType) {
  return saleErrorMessages[code];
}

// Mensaje con el detalle concreto cuando lo hay: "Quedan 1,5 kg de Tomate" le
// sirve al vendedor mucho más que "no hay stock suficiente".
export function getSaleErrorMessageFor(error: SaleError): string {
  if (error.code === SaleErrorCode.INSUFFICIENT_STOCK && error.detail?.productName) {
    const available = error.detail.available ?? 0;

    return available > 0
      ? `Quedan ${formatQuantity(available)} de ${error.detail.productName}.`
      : `No queda stock de ${error.detail.productName}.`;
  }

  if (error.code === SaleErrorCode.FRACTIONAL_QUANTITY_NOT_ALLOWED && error.detail?.productName) {
    return `${error.detail.productName} se vende por unidades enteras.`;
  }

  return saleErrorMessages[error.code];
}
