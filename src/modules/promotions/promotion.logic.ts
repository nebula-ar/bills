import type { PromotionScope, PromotionType } from "@/generated/prisma/client";
import { lineTotal, wholeUnits } from "@/lib/quantity";

// Motor de promociones: dado un carrito y las promos vigentes, decide cuánto se
// descuenta y de qué renglón sale. Es lógica pura (sin Prisma ni fechas
// implícitas: el "ahora" se pasa por parámetro) para poder testearla entera.
//
// Regla de oro: un renglón lo descuenta UNA sola promo. Se recorren por
// prioridad y la primera que agarra un renglón se lo queda. Sin esto, dos
// promos superpuestas pueden dejar un total en cero y nadie entiende por qué.

export type PromotionRule = {
  id: string;
  name: string;
  type: PromotionType;
  scope: PromotionScope;
  percentOff: number | null;
  fixedOff: number | null;
  buyQuantity: number | null;
  payQuantity: number | null;
  bundlePrice: number | null;
  minQuantity: number | null;
  minAmount: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  // Días ISO separados por coma ("1,2,3" = lun/mar/mié). null = todos.
  weekdays: string | null;
  priority: number;
  productIds: string[];
  categoryIds: string[];
};

export type CartLine = {
  productId: string | null;
  categoryId: string | null;
  description: string;
  // En milésimas (ver src/lib/quantity.ts).
  quantity: number;
  unitPrice: number;
};

export type AppliedDiscount = {
  promotionId: string;
  description: string;
  amount: number;
};

export type PromotionResult = {
  subtotal: number;
  discountTotal: number;
  total: number;
  discounts: AppliedDiscount[];
  // Descuento imputado a cada renglón, en el mismo orden que `lines`.
  discountByLine: number[];
};

export function applyPromotions(lines: CartLine[], promotions: PromotionRule[], at: Date): PromotionResult {
  const lineSubtotals = lines.map((line) => lineTotal(line.unitPrice, line.quantity));
  const subtotal = sum(lineSubtotals);

  const discountByLine = new Array<number>(lines.length).fill(0);
  const discounts: AppliedDiscount[] = [];
  const taken = new Set<number>();

  const candidates = promotions
    .filter((promotion) => isLive(promotion, at))
    // Mayor prioridad primero; ante empate, orden estable por id.
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));

  for (const promotion of candidates) {
    const indexes = lines
      .map((line, index) => ({ line, index }))
      .filter(({ line, index }) => !taken.has(index) && matches(promotion, line))
      .map(({ index }) => index);

    if (indexes.length === 0) {
      continue;
    }

    const matchedSubtotal = sum(indexes.map((index) => lineSubtotals[index]));
    const matchedQuantity = sum(indexes.map((index) => lines[index].quantity));

    if (promotion.minQuantity !== null && matchedQuantity < promotion.minQuantity) {
      continue;
    }

    if (promotion.minAmount !== null && matchedSubtotal < promotion.minAmount) {
      continue;
    }

    const amount = Math.min(computeAmount(promotion, indexes, lines, matchedSubtotal), matchedSubtotal);

    if (amount <= 0) {
      continue;
    }

    discounts.push({ promotionId: promotion.id, description: promotion.name, amount });
    spread(amount, indexes, lineSubtotals, discountByLine);
    indexes.forEach((index) => taken.add(index));
  }

  const discountTotal = sum(discountByLine);

  return {
    subtotal,
    discountTotal,
    total: subtotal - discountTotal,
    discounts,
    discountByLine,
  };
}

/**
 * Qué promos vigentes le pegan a un producto, ahora.
 *
 * Sirve para avisarlo en la ficha: al cargar un precio hay que saber si ese
 * producto ya está con 20% off, porque si no se termina descontando dos veces.
 * Reusa las MISMAS reglas que el cobro (`isLive` y `matches`): si la ficha
 * dijera algo distinto de lo que después cobra la caja, sería peor que no
 * decir nada.
 *
 * Es informativo: no dice cuánto va a descontar, porque eso depende del
 * carrito entero (mínimos por monto, NxM, combos).
 */
export function promocionesDeProducto(
  promotions: PromotionRule[],
  producto: { productId: string; categoryId: string | null },
  at: Date,
): PromotionRule[] {
  const linea: CartLine = {
    productId: producto.productId,
    categoryId: producto.categoryId,
    description: "",
    quantity: 0,
    unitPrice: 0,
  };

  return promotions
    .filter((promotion) => isLive(promotion, at) && matches(promotion, linea))
    .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name, "es"));
}

// ¿La promo está vigente ahora? Chequea activación por fecha y por día de semana.
function isLive(promotion: PromotionRule, at: Date): boolean {
  if (promotion.startsAt && at < promotion.startsAt) {
    return false;
  }

  if (promotion.endsAt && at > promotion.endsAt) {
    return false;
  }

  if (promotion.weekdays) {
    // getDay(): 0 = domingo. Lo pasamos a ISO (1 = lunes … 7 = domingo).
    const isoDay = at.getDay() === 0 ? 7 : at.getDay();
    const allowed = promotion.weekdays
      .split(",")
      .map((day) => Number(day.trim()))
      .filter((day) => Number.isInteger(day));

    if (allowed.length > 0 && !allowed.includes(isoDay)) {
      return false;
    }
  }

  return true;
}

function matches(promotion: PromotionRule, line: CartLine): boolean {
  switch (promotion.scope) {
    case "ALL":
      return true;
    case "PRODUCT":
      return line.productId !== null && promotion.productIds.includes(line.productId);
    case "CATEGORY":
      return line.categoryId !== null && promotion.categoryIds.includes(line.categoryId);
    default:
      return false;
  }
}

function computeAmount(
  promotion: PromotionRule,
  indexes: number[],
  lines: CartLine[],
  matchedSubtotal: number,
): number {
  switch (promotion.type) {
    case "PERCENT_OFF": {
      const percent = promotion.percentOff ?? 0;
      if (percent <= 0) return 0;
      return Math.round((matchedSubtotal * Math.min(percent, 100)) / 100);
    }

    case "FIXED_OFF": {
      return Math.max(promotion.fixedOff ?? 0, 0);
    }

    case "NX_M": {
      // "Llevá N, pagá M": se regalan las unidades más baratas del combo, que
      // es como lo hace cualquier comercio (y como lo espera el cliente).
      const buy = promotion.buyQuantity ?? 0;
      const pay = promotion.payQuantity ?? 0;

      if (buy <= 0 || pay < 0 || pay >= buy) {
        return 0;
      }

      const units = sum(indexes.map((index) => wholeUnits(lines[index].quantity)));
      const freeUnits = Math.floor(units / buy) * (buy - pay);

      if (freeUnits <= 0) {
        return 0;
      }

      const cheapest = Math.min(...indexes.map((index) => lines[index].unitPrice));
      return freeUnits * cheapest;
    }

    case "BUNDLE_PRICE": {
      // Combo a precio cerrado: hay que tener al menos una unidad de CADA
      // producto del combo. Se aplica tantas veces como combos completos entren.
      const bundlePrice = promotion.bundlePrice ?? 0;

      if (bundlePrice <= 0 || promotion.productIds.length === 0) {
        return 0;
      }

      const unitsByProduct = new Map<string, number>();
      const priceByProduct = new Map<string, number>();

      for (const index of indexes) {
        const line = lines[index];
        if (!line.productId) continue;
        unitsByProduct.set(line.productId, (unitsByProduct.get(line.productId) ?? 0) + wholeUnits(line.quantity));
        // Ante dos renglones del mismo producto, vale el precio más alto: el
        // descuento nunca debe superar lo que el cliente iba a pagar.
        priceByProduct.set(line.productId, Math.max(priceByProduct.get(line.productId) ?? 0, line.unitPrice));
      }

      const sets = Math.min(...promotion.productIds.map((productId) => unitsByProduct.get(productId) ?? 0));

      if (!Number.isFinite(sets) || sets <= 0) {
        return 0;
      }

      const listPrice = sum(promotion.productIds.map((productId) => priceByProduct.get(productId) ?? 0));

      return Math.max(sets * (listPrice - bundlePrice), 0);
    }

    default:
      return 0;
  }
}

// Reparte el descuento entre los renglones alcanzados, en proporción a lo que
// pesa cada uno. El último se lleva el resto para que la suma cierre exacta.
function spread(amount: number, indexes: number[], lineSubtotals: number[], discountByLine: number[]) {
  const matchedSubtotal = sum(indexes.map((index) => lineSubtotals[index]));

  if (matchedSubtotal <= 0) {
    return;
  }

  let assigned = 0;

  indexes.forEach((index, position) => {
    const isLast = position === indexes.length - 1;
    const share = isLast
      ? amount - assigned
      : Math.round((amount * lineSubtotals[index]) / matchedSubtotal);

    discountByLine[index] += share;
    assigned += share;
  });
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
