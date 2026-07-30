import { Unit } from "@/generated/prisma/enums";

// Las cantidades se guardan como enteros en MILÉSIMAS de la unidad de venta.
// Motivo: una barbería vende "1 corte" pero una verdulería vende "1,250 kg" y
// una mercería "2,5 m". Guardar decimales en punto flotante haría que los
// totales no cierren; con milésimas todo es aritmética entera.
//
//   1 unidad   -> 1000
//   1,250 kg   -> 1250
//   0,5 m      ->  500
export const QUANTITY_SCALE = 1000;

// Una unidad entera, el valor por defecto de casi todos los renglones.
export const ONE = QUANTITY_SCALE;

// Unidades que admiten fracciones. `UNIT`, `PACK` y `DOZEN` se venden enteras:
// nadie vende medio paquete de galletitas.
const FRACTIONAL_UNITS: ReadonlySet<Unit> = new Set([Unit.KG, Unit.GRAM, Unit.LITER, Unit.METER]);

export function allowsFraction(unit: Unit): boolean {
  return FRACTIONAL_UNITS.has(unit);
}

const UNIT_SHORT: Record<Unit, string> = {
  [Unit.UNIT]: "un",
  [Unit.KG]: "kg",
  [Unit.GRAM]: "g",
  [Unit.LITER]: "L",
  [Unit.METER]: "m",
  [Unit.PACK]: "pack",
  [Unit.DOZEN]: "doc",
};

const UNIT_LABEL: Record<Unit, string> = {
  [Unit.UNIT]: "Unidad",
  [Unit.KG]: "Kilogramo",
  [Unit.GRAM]: "Gramo",
  [Unit.LITER]: "Litro",
  [Unit.METER]: "Metro",
  [Unit.PACK]: "Paquete",
  [Unit.DOZEN]: "Docena",
};

export function unitShort(unit: Unit): string {
  return UNIT_SHORT[unit];
}

export function unitLabel(unit: Unit): string {
  return UNIT_LABEL[unit];
}

// "Precio por kg" / "Precio por unidad": cómo se le explica el precio al usuario.
export function pricePerUnitLabel(unit: Unit): string {
  return unit === Unit.UNIT ? "Precio por unidad" : `Precio por ${UNIT_LABEL[unit].toLowerCase()}`;
}

// Parsea una cantidad tipeada por el usuario (formato es-AR: coma decimal).
//   "2"      -> 2000
//   "1,250"  -> 1250
//   "0,5"    ->  500
// Devuelve null si no es válida (vacío, no numérica, negativa, cero, con
// fracción en una unidad que no la admite, o con más de 3 decimales).
export function parseQuantityInput(raw: string, unit: Unit = Unit.UNIT): number | null {
  const normalized = raw.trim().replace(",", ".");

  if (normalized === "" || !/^\d*\.?\d*$/.test(normalized)) {
    return null;
  }

  const value = Number(normalized);

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  // Redondeamos a milésimas: más precisión que eso no la soporta el formato.
  const quantity = Math.round(value * QUANTITY_SCALE);

  if (quantity <= 0) {
    return null;
  }

  if (!allowsFraction(unit) && quantity % QUANTITY_SCALE !== 0) {
    return null;
  }

  return quantity;
}

// Formatea una cantidad para mostrar. Sin decimales inútiles: 2000 -> "2",
// 1250 -> "1,25", 1500 con unidad -> "1,5 kg".
export function formatQuantity(quantity: number, unit?: Unit): string {
  const whole = Math.trunc(quantity / QUANTITY_SCALE);
  const fraction = Math.abs(quantity % QUANTITY_SCALE);

  const number =
    fraction === 0
      ? String(whole)
      : `${whole},${String(fraction).padStart(3, "0").replace(/0+$/, "")}`;

  return unit ? `${number} ${UNIT_SHORT[unit]}` : number;
}

// Total de un renglón: precio unitario × cantidad, en pesos enteros.
// El redondeo va acá y en un solo lugar, para que la suma de los renglones
// siempre coincida con el total de la venta.
export function lineTotal(unitPrice: number, quantity: number): number {
  return Math.round((unitPrice * quantity) / QUANTITY_SCALE);
}

// Cantidad de unidades enteras representadas, redondeando hacia arriba. Se usa
// donde una fracción no tiene sentido (ej: contar ítems de una promo 3x2).
export function wholeUnits(quantity: number): number {
  return Math.ceil(quantity / QUANTITY_SCALE);
}
