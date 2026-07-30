import { ONE } from "@/lib/quantity";
import { describe, expect, it } from "vitest";

import { defaultValidUntil, quoteLineTotal, quoteTotals, quoteValidity } from "./quote.logic";

describe("quoteLineTotal", () => {
  it("cobra una unidad a su precio", () => {
    expect(quoteLineTotal({ quantity: ONE, unitPrice: 12_000 })).toBe(12_000);
  });

  it("cobra fracciones de kilo redondeando una sola vez", () => {
    // 1,250 kg a $8.000 el kilo = $10.000
    expect(quoteLineTotal({ quantity: 1_250, unitPrice: 8_000 })).toBe(10_000);
  });

  it("no arrastra medio peso de error en cantidades chicas", () => {
    // 0,333 kg a $1.000 = $333
    expect(quoteLineTotal({ quantity: 333, unitPrice: 1_000 })).toBe(333);
  });
});

describe("quoteTotals", () => {
  const lines = [
    { quantity: 2 * ONE, unitPrice: 5_000 },
    { quantity: ONE, unitPrice: 3_000 },
  ];

  it("suma los renglones", () => {
    expect(quoteTotals(lines)).toEqual({ subtotal: 13_000, discountTotal: 0, total: 13_000 });
  });

  it("aplica el descuento negociado", () => {
    expect(quoteTotals(lines, 1_000)).toEqual({ subtotal: 13_000, discountTotal: 1_000, total: 12_000 });
  });

  it("nunca deja el total en negativo", () => {
    expect(quoteTotals(lines, 99_000)).toEqual({ subtotal: 13_000, discountTotal: 13_000, total: 0 });
  });

  it("ignora un descuento negativo", () => {
    expect(quoteTotals(lines, -500).total).toBe(13_000);
  });

  it("un presupuesto vacío vale cero", () => {
    expect(quoteTotals([], 1_000)).toEqual({ subtotal: 0, discountTotal: 0, total: 0 });
  });
});

describe("quoteValidity", () => {
  const now = new Date(2026, 6, 20, 15, 30);

  it("vale todo el día del vencimiento, aunque sea más tarde que la emisión", () => {
    const validity = quoteValidity(new Date(2026, 6, 20, 9, 0), now);
    expect(validity).toEqual({ expired: false, daysLeft: 0 });
  });

  it("cuenta los días que faltan", () => {
    expect(quoteValidity(new Date(2026, 6, 27), now).daysLeft).toBe(7);
  });

  it("marca vencido el día siguiente", () => {
    expect(quoteValidity(new Date(2026, 6, 19), now)).toEqual({ expired: true, daysLeft: -1 });
  });
});

describe("defaultValidUntil", () => {
  it("da una semana y llega hasta el final de ese día", () => {
    const end = defaultValidUntil(new Date(2026, 6, 20, 15, 30));
    expect(end.getDate()).toBe(27);
    expect(end.getHours()).toBe(23);
  });

  it("acepta otro plazo", () => {
    expect(defaultValidUntil(new Date(2026, 6, 20), 30).getMonth()).toBe(7);
  });
});
