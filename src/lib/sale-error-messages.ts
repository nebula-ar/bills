import { SaleErrorCode, type SaleErrorCode as SaleErrorCodeType } from "@/modules/sales/sale.errors";

const saleErrorMessages: Record<SaleErrorCodeType, string> = {
  [SaleErrorCode.BRANCH_NOT_FOUND]: "No encontramos la sucursal seleccionada.",
  [SaleErrorCode.BARBER_NOT_AVAILABLE]: "El barbero seleccionado no está disponible.",
  [SaleErrorCode.BARBER_INVALID_ROLE]: "La persona seleccionada no puede registrar ventas como barbero.",
  [SaleErrorCode.BARBER_WRONG_BRANCH]: "El barbero seleccionado no pertenece a esta sucursal.",
  [SaleErrorCode.EMPTY_ITEMS]: "Seleccioná al menos un servicio.",
  [SaleErrorCode.EMPTY_PAYMENTS]: "Seleccioná un método de pago.",
  [SaleErrorCode.INVALID_ITEM_QUANTITY]: "La cantidad debe ser mayor a cero.",
  [SaleErrorCode.INVALID_PAYMENT_AMOUNT]: "El importe del pago debe ser mayor a cero.",
  [SaleErrorCode.SERVICE_NOT_AVAILABLE]: "El servicio seleccionado no está disponible en esta sucursal.",
  [SaleErrorCode.PAYMENTS_TOTAL_MISMATCH]: "El importe del pago no coincide con el total de la venta.",
  [SaleErrorCode.SALE_NOT_FOUND]: "No encontramos la venta o ya no está disponible.",
  [SaleErrorCode.SALE_ALREADY_CANCELLED]: "La venta ya estaba cancelada.",
};

export function getSaleErrorMessage(code: SaleErrorCodeType) {
  return saleErrorMessages[code];
}
