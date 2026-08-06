import { PromotionScope, PromotionType } from "@/generated/prisma/enums";
import {
  PromotionError,
  PromotionErrorCode,
  type PromotionErrorCode as PromotionErrorCodeType,
} from "@/modules/promotions/promotion.errors";

export const PROMOTION_TYPE_LABELS: Record<PromotionType, string> = {
  [PromotionType.PERCENT_OFF]: "Descuento %",
  [PromotionType.FIXED_OFF]: "Descuento fijo",
  [PromotionType.NX_M]: "Llevá N, pagá M",
  [PromotionType.BUNDLE_PRICE]: "Combo a precio cerrado",
};

export const PROMOTION_TYPE_HINTS: Record<PromotionType, string> = {
  [PromotionType.PERCENT_OFF]: "Ej: 20% off en toda la categoría Bebidas.",
  [PromotionType.FIXED_OFF]: "Ej: $2.000 menos llevando más de $20.000.",
  [PromotionType.NX_M]: "Ej: 3x2 en golosinas — la más barata va de regalo.",
  [PromotionType.BUNDLE_PRICE]: "Ej: corte + barba a $13.000 en vez de $15.500.",
};

/**
 * El descuento en dos palabras: "20% off", "3x2", "-$2.000", "Combo $13.000".
 *
 * Va corto porque se muestra al lado del precio en la ficha del producto,
 * donde lo que importa es reconocer de un vistazo que ese precio no es el que
 * se va a cobrar. El detalle está en la pantalla de promociones.
 */
export function promotionShortLabel(promocion: {
  type: PromotionType;
  percentOff: number | null;
  fixedOff: number | null;
  buyQuantity: number | null;
  payQuantity: number | null;
  bundlePrice: number | null;
}): string {
  const pesos = (valor: number) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(valor);

  switch (promocion.type) {
    case PromotionType.PERCENT_OFF:
      return promocion.percentOff ? `${promocion.percentOff}% off` : "Descuento";
    case PromotionType.FIXED_OFF:
      return promocion.fixedOff ? `−${pesos(promocion.fixedOff)}` : "Descuento";
    case PromotionType.NX_M:
      return promocion.buyQuantity && promocion.payQuantity
        ? `${promocion.buyQuantity}x${promocion.payQuantity}`
        : "Llevá y pagá menos";
    case PromotionType.BUNDLE_PRICE:
      return promocion.bundlePrice ? `Combo ${pesos(promocion.bundlePrice)}` : "Combo";
    default:
      return "Descuento";
  }
}

export const PROMOTION_SCOPE_LABELS: Record<PromotionScope, string> = {
  [PromotionScope.ALL]: "Toda la venta",
  [PromotionScope.CATEGORY]: "Categorías elegidas",
  [PromotionScope.PRODUCT]: "Productos elegidos",
};

export const PROMOTION_TYPE_ORDER: PromotionType[] = [
  PromotionType.PERCENT_OFF,
  PromotionType.FIXED_OFF,
  PromotionType.NX_M,
  PromotionType.BUNDLE_PRICE,
];

// Días de la semana en ISO (1 = lunes), que es como los guarda `weekdays`.
export const WEEKDAYS: { value: number; label: string; short: string }[] = [
  { value: 1, label: "Lunes", short: "L" },
  { value: 2, label: "Martes", short: "M" },
  { value: 3, label: "Miércoles", short: "M" },
  { value: 4, label: "Jueves", short: "J" },
  { value: 5, label: "Viernes", short: "V" },
  { value: 6, label: "Sábado", short: "S" },
  { value: 7, label: "Domingo", short: "D" },
];

export function describeWeekdays(weekdays: string | null): string {
  if (!weekdays) {
    return "Todos los días";
  }

  const days = weekdays
    .split(",")
    .map((day) => Number(day.trim()))
    .filter((day) => Number.isInteger(day));

  if (days.length === 0 || days.length === 7) {
    return "Todos los días";
  }

  return days.map((day) => WEEKDAYS.find((weekday) => weekday.value === day)?.label ?? "").filter(Boolean).join(", ");
}

const promotionErrorMessages: Record<PromotionErrorCodeType, string> = {
  [PromotionErrorCode.PROMOTION_NOT_FOUND]: "No encontramos la promoción.",
  [PromotionErrorCode.INVALID_NAME]: "Ponele un nombre a la promoción.",
  [PromotionErrorCode.INVALID_PERCENT]: "El descuento tiene que estar entre 1% y 100%.",
  [PromotionErrorCode.INVALID_AMOUNT]: "Ingresá un monto de descuento válido.",
  [PromotionErrorCode.INVALID_NX_M]: "Revisá el N y el M: llevás más de lo que pagás (ej: 3 y 2).",
  [PromotionErrorCode.INVALID_BUNDLE]: "Ingresá el precio cerrado del combo.",
  [PromotionErrorCode.BUNDLE_NEEDS_PRODUCTS]: "Un combo necesita al menos dos productos.",
  [PromotionErrorCode.SCOPE_NEEDS_TARGETS]: "Elegí a qué productos o categorías aplica.",
  [PromotionErrorCode.INVALID_DATE_RANGE]: "La fecha de inicio tiene que ser anterior a la de fin.",
};

export function getPromotionErrorMessage(code: PromotionErrorCodeType) {
  return promotionErrorMessages[code];
}

export function getPromotionErrorMessageFor(error: PromotionError) {
  return promotionErrorMessages[error.code];
}
