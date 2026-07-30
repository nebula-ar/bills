// Lógica pura de presupuestos: totales y vigencia.
//
// La regla que importa: un presupuesto vencido NO se bloquea, se avisa. El
// cliente que vuelve a los quince días con el papel en la mano merece que le
// digan "esto venció el martes, te lo rehago con el precio de hoy" y no un
// error de sistema.

import { lineTotal } from "@/lib/quantity";
import type { Unit } from "@/generated/prisma/enums";

export type QuoteLineInput = {
  // Cantidad en milésimas (1 unidad = 1000).
  quantity: number;
  unitPrice: number;
};

export type QuoteLine = QuoteLineInput & {
  description: string;
  unit: Unit;
  total: number;
};

export type QuoteTotals = {
  subtotal: number;
  discountTotal: number;
  total: number;
};

// Redondea una sola vez por renglón, igual que la venta: si cada línea se
// redondeara dos veces, el presupuesto y la venta darían distinto y el cliente
// lo notaría en el mostrador.
export function quoteLineTotal(line: QuoteLineInput): number {
  return lineTotal(line.quantity, line.unitPrice);
}

// `discount` es un descuento manual sobre el total (el "te lo dejo en tanto"
// que se negocia cuando el cliente pregunta). Nunca deja el total en negativo.
export function quoteTotals(lines: QuoteLineInput[], discount = 0): QuoteTotals {
  const subtotal = lines.reduce((sum, line) => sum + quoteLineTotal(line), 0);
  const discountTotal = Math.min(Math.max(Math.trunc(discount), 0), subtotal);

  return { subtotal, discountTotal, total: subtotal - discountTotal };
}

export type QuoteValidity = {
  expired: boolean;
  // Días que faltan. 0 = vence hoy, negativo = venció hace tantos días.
  daysLeft: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Compara por DÍA, no por instante: un presupuesto que vale "hasta el viernes"
// vale todo el viernes, no hasta la hora en que se emitió.
export function quoteValidity(validUntil: Date, now: Date): QuoteValidity {
  const end = startOfDay(validUntil);
  const today = startOfDay(now);
  const daysLeft = Math.round((end.getTime() - today.getTime()) / DAY_MS);

  return { expired: daysLeft < 0, daysLeft };
}

// Vencimiento por defecto: una semana. Es lo que dura un precio en la práctica
// cuando la lista del proveedor cambia todos los meses.
export const DEFAULT_VALIDITY_DAYS = 7;

export function defaultValidUntil(now: Date, days = DEFAULT_VALIDITY_DAYS): Date {
  const end = startOfDay(now);
  end.setDate(end.getDate() + days);
  end.setHours(23, 59, 59, 999);
  return end;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
