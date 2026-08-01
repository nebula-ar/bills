import { StockMovementType } from "@/generated/prisma/enums";
import { formatQuantity } from "@/lib/quantity";
import { StockError, StockErrorCode, type StockErrorCode as StockErrorCodeType } from "@/modules/stock/stock.errors";

const stockErrorMessages: Record<StockErrorCodeType, string> = {
  [StockErrorCode.PRODUCT_NOT_FOUND]: "No encontramos el producto.",
  [StockErrorCode.PRODUCT_NOT_TRACKED]: "Ese producto no lleva control de stock.",
  [StockErrorCode.BRANCH_NOT_FOUND]: "No encontramos la sucursal.",
  [StockErrorCode.INVALID_QUANTITY]: "Ingresá una cantidad válida.",
  [StockErrorCode.INVALID_COST]: "Ingresá un costo válido en pesos.",
  [StockErrorCode.SAME_BRANCH_TRANSFER]: "Elegí dos sucursales distintas para el traspaso.",
  [StockErrorCode.INSUFFICIENT_STOCK]: "No hay stock suficiente.",
};

export function getStockErrorMessage(code: StockErrorCodeType) {
  return stockErrorMessages[code];
}

export function getStockErrorMessageFor(error: StockError): string {
  if (error.code === StockErrorCode.INSUFFICIENT_STOCK && error.detail?.productName) {
    return `Solo quedan ${formatQuantity(error.detail.available ?? 0)} de ${error.detail.productName}.`;
  }

  if (error.code === StockErrorCode.PRODUCT_NOT_TRACKED && error.detail?.productName) {
    return `${error.detail.productName} no lleva control de stock. Activalo desde el catálogo.`;
  }

  return stockErrorMessages[error.code];
}

// Etiquetas del libro de movimientos: el dueño tiene que entender de un vistazo
// por qué cambió una existencia.
export const STOCK_MOVEMENT_LABELS: Record<StockMovementType, string> = {
  [StockMovementType.INITIAL]: "Carga inicial",
  [StockMovementType.PURCHASE]: "Ingreso por compra",
  [StockMovementType.PURCHASE_CANCELLED]: "Compra anulada",
  [StockMovementType.SALE]: "Venta",
  [StockMovementType.SALE_CANCELLED]: "Venta anulada",
  [StockMovementType.ADJUSTMENT]: "Ajuste por conteo",
  [StockMovementType.TRANSFER_IN]: "Entrada por traspaso",
  [StockMovementType.TRANSFER_OUT]: "Salida por traspaso",
  [StockMovementType.LOSS]: "Merma",
  [StockMovementType.RETURN]: "Devolución",
};
