import type { PromotionScope, PromotionType } from "@/generated/prisma/client";
import { ONE } from "@/lib/quantity";
import { describe, expect, it } from "vitest";

import { applyPromotions, type CartLine, type PromotionRule } from "./promotion.logic";

// Un lunes al mediodía, para que las promos por día de semana sean deterministas.
const MONDAY = new Date("2026-07-27T12:00:00");

function rule(overrides: Partial<PromotionRule> & { id: string; type: PromotionType }): PromotionRule {
  return {
    name: overrides.name ?? `Promo ${overrides.id}`,
    scope: "ALL" as PromotionScope,
    percentOff: null,
    fixedOff: null,
    buyQuantity: null,
    payQuantity: null,
    bundlePrice: null,
    minQuantity: null,
    minAmount: null,
    startsAt: null,
    endsAt: null,
    weekdays: null,
    priority: 0,
    productIds: [],
    categoryIds: [],
    ...overrides,
  };
}

function line(overrides: Partial<CartLine> & { unitPrice: number }): CartLine {
  return {
    productId: null,
    categoryId: null,
    description: "Ítem",
    quantity: ONE,
    ...overrides,
  };
}

describe("applyPromotions", () => {
  it("sin promos, el total es el subtotal", () => {
    const result = applyPromotions([line({ unitPrice: 1000 }), line({ unitPrice: 500 })], [], MONDAY);

    expect(result.subtotal).toBe(1500);
    expect(result.discountTotal).toBe(0);
    expect(result.total).toBe(1500);
    expect(result.discounts).toEqual([]);
  });

  it("PERCENT_OFF descuenta el porcentaje del subtotal alcanzado", () => {
    const result = applyPromotions(
      [line({ unitPrice: 1000 }), line({ unitPrice: 1000 })],
      [rule({ id: "p1", type: "PERCENT_OFF" as PromotionType, percentOff: 10 })],
      MONDAY,
    );

    expect(result.discountTotal).toBe(200);
    expect(result.total).toBe(1800);
    // El descuento se reparte proporcionalmente entre los dos renglones.
    expect(result.discountByLine).toEqual([100, 100]);
  });

  it("FIXED_OFF nunca descuenta más que lo que suma el carrito", () => {
    const result = applyPromotions(
      [line({ unitPrice: 500 })],
      [rule({ id: "p1", type: "FIXED_OFF" as PromotionType, fixedOff: 5000 })],
      MONDAY,
    );

    expect(result.discountTotal).toBe(500);
    expect(result.total).toBe(0);
  });

  it("NX_M (3x2) regala la unidad más barata cada tres", () => {
    const result = applyPromotions(
      [
        line({ productId: "a", unitPrice: 1000, quantity: 2 * ONE }),
        line({ productId: "b", unitPrice: 600 }),
      ],
      [
        rule({
          id: "p1",
          type: "NX_M" as PromotionType,
          scope: "PRODUCT" as PromotionScope,
          productIds: ["a", "b"],
          buyQuantity: 3,
          payQuantity: 2,
        }),
      ],
      MONDAY,
    );

    // 3 unidades en total -> 1 gratis, la de 600.
    expect(result.discountTotal).toBe(600);
    expect(result.total).toBe(2000);
  });

  it("NX_M no aplica si no se llega a la cantidad", () => {
    const result = applyPromotions(
      [line({ productId: "a", unitPrice: 1000, quantity: 2 * ONE })],
      [
        rule({
          id: "p1",
          type: "NX_M" as PromotionType,
          scope: "PRODUCT" as PromotionScope,
          productIds: ["a"],
          buyQuantity: 3,
          payQuantity: 2,
        }),
      ],
      MONDAY,
    );

    expect(result.discountTotal).toBe(0);
  });

  it("BUNDLE_PRICE cobra el combo cerrado y se repite por combo completo", () => {
    const result = applyPromotions(
      [
        line({ productId: "corte", unitPrice: 9000, quantity: 2 * ONE }),
        line({ productId: "barba", unitPrice: 6500, quantity: 2 * ONE }),
      ],
      [
        rule({
          id: "p1",
          type: "BUNDLE_PRICE" as PromotionType,
          scope: "PRODUCT" as PromotionScope,
          productIds: ["corte", "barba"],
          bundlePrice: 13000,
        }),
      ],
      MONDAY,
    );

    // Lista: 15.500 por combo. Combo: 13.000. Descuento 2.500 × 2 combos.
    expect(result.discountTotal).toBe(5000);
    expect(result.total).toBe(31_000 - 5000);
  });

  it("BUNDLE_PRICE no aplica si falta un producto del combo", () => {
    const result = applyPromotions(
      [line({ productId: "corte", unitPrice: 9000 })],
      [
        rule({
          id: "p1",
          type: "BUNDLE_PRICE" as PromotionType,
          scope: "PRODUCT" as PromotionScope,
          productIds: ["corte", "barba"],
          bundlePrice: 13000,
        }),
      ],
      MONDAY,
    );

    expect(result.discountTotal).toBe(0);
  });

  it("un renglón lo descuenta una sola promo: gana la de mayor prioridad", () => {
    const result = applyPromotions(
      [line({ productId: "a", unitPrice: 1000 })],
      [
        rule({ id: "baja", type: "PERCENT_OFF" as PromotionType, percentOff: 10, priority: 1 }),
        rule({ id: "alta", type: "PERCENT_OFF" as PromotionType, percentOff: 50, priority: 9 }),
      ],
      MONDAY,
    );

    expect(result.discountTotal).toBe(500);
    expect(result.discounts).toHaveLength(1);
    expect(result.discounts[0].promotionId).toBe("alta");
  });

  it("dos promos conviven si agarran renglones distintos", () => {
    const result = applyPromotions(
      [line({ productId: "a", unitPrice: 1000 }), line({ productId: "b", unitPrice: 2000 })],
      [
        rule({
          id: "pa",
          type: "PERCENT_OFF" as PromotionType,
          scope: "PRODUCT" as PromotionScope,
          productIds: ["a"],
          percentOff: 10,
          priority: 5,
        }),
        rule({
          id: "pb",
          type: "PERCENT_OFF" as PromotionType,
          scope: "PRODUCT" as PromotionScope,
          productIds: ["b"],
          percentOff: 50,
          priority: 4,
        }),
      ],
      MONDAY,
    );

    expect(result.discounts).toHaveLength(2);
    expect(result.discountByLine).toEqual([100, 1000]);
    expect(result.total).toBe(1900);
  });

  it("respeta el mínimo de compra", () => {
    const promotion = rule({ id: "p1", type: "PERCENT_OFF" as PromotionType, percentOff: 10, minAmount: 5000 });

    expect(applyPromotions([line({ unitPrice: 4000 })], [promotion], MONDAY).discountTotal).toBe(0);
    expect(applyPromotions([line({ unitPrice: 6000 })], [promotion], MONDAY).discountTotal).toBe(600);
  });

  it("respeta la vigencia por fecha", () => {
    const vencida = rule({
      id: "p1",
      type: "PERCENT_OFF" as PromotionType,
      percentOff: 10,
      endsAt: new Date("2026-07-01T00:00:00"),
    });

    expect(applyPromotions([line({ unitPrice: 1000 })], [vencida], MONDAY).discountTotal).toBe(0);
  });

  it("respeta el día de la semana", () => {
    const soloMartes = rule({ id: "p1", type: "PERCENT_OFF" as PromotionType, percentOff: 10, weekdays: "2" });
    const soloLunes = rule({ id: "p2", type: "PERCENT_OFF" as PromotionType, percentOff: 10, weekdays: "1,3" });

    expect(applyPromotions([line({ unitPrice: 1000 })], [soloMartes], MONDAY).discountTotal).toBe(0);
    expect(applyPromotions([line({ unitPrice: 1000 })], [soloLunes], MONDAY).discountTotal).toBe(100);
  });

  it("aplica el porcentaje sobre cantidades fraccionarias (1,5 kg)", () => {
    const result = applyPromotions(
      [line({ unitPrice: 2000, quantity: 1500 })],
      [rule({ id: "p1", type: "PERCENT_OFF" as PromotionType, percentOff: 10 })],
      MONDAY,
    );

    expect(result.subtotal).toBe(3000);
    expect(result.discountTotal).toBe(300);
  });

  it("el descuento repartido siempre suma exactamente el total descontado", () => {
    const result = applyPromotions(
      [line({ unitPrice: 333 }), line({ unitPrice: 333 }), line({ unitPrice: 333 })],
      [rule({ id: "p1", type: "PERCENT_OFF" as PromotionType, percentOff: 33 })],
      MONDAY,
    );

    const repartido = result.discountByLine.reduce((total, value) => total + value, 0);

    expect(repartido).toBe(result.discountTotal);
    expect(result.subtotal - result.discountTotal).toBe(result.total);
  });
});
