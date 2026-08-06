import { describe, expect, it } from "vitest";

import { PromotionScope, PromotionType } from "@/generated/prisma/enums";

import { promocionesDeProducto, type PromotionRule } from "./promotion.logic";

/**
 * Qué promos se le avisan al dueño en la ficha del producto.
 *
 * Lo que se prueba es que la ficha diga EXACTAMENTE lo mismo que después cobra
 * la caja: una ficha que promete un descuento que no se aplica (o que calla uno
 * que sí) es peor que no mostrar nada.
 */

const MIERCOLES = new Date(2026, 7, 5, 12, 0, 0);

const promo = (parcial: Partial<PromotionRule> = {}): PromotionRule => ({
  id: "p1",
  name: "Promo",
  type: PromotionType.PERCENT_OFF,
  scope: PromotionScope.ALL,
  percentOff: 20,
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
  ...parcial,
});

const alfajor = { productId: "prod-1", categoryId: "cat-1" };
const nombres = (reglas: PromotionRule[]) => reglas.map((r) => r.name);

describe("qué promos afectan a un producto", () => {
  it("las de toda la venta le pegan a cualquiera", () => {
    expect(nombres(promocionesDeProducto([promo({ name: "10% en todo" })], alfajor, MIERCOLES))).toEqual([
      "10% en todo",
    ]);
  });

  it("las de producto, solo si es ESE producto", () => {
    const reglas = [
      promo({ id: "a", name: "Para el alfajor", scope: PromotionScope.PRODUCT, productIds: ["prod-1"] }),
      promo({ id: "b", name: "Para otro", scope: PromotionScope.PRODUCT, productIds: ["prod-9"] }),
    ];
    expect(nombres(promocionesDeProducto(reglas, alfajor, MIERCOLES))).toEqual(["Para el alfajor"]);
  });

  it("las de categoría siguen a la categoría del producto", () => {
    const reglas = [
      promo({ id: "a", name: "Pastelería", scope: PromotionScope.CATEGORY, categoryIds: ["cat-1"] }),
      promo({ id: "b", name: "Bebidas", scope: PromotionScope.CATEGORY, categoryIds: ["cat-9"] }),
    ];
    expect(nombres(promocionesDeProducto(reglas, alfajor, MIERCOLES))).toEqual(["Pastelería"]);
  });

  it("un producto sin categoría no hereda promos de categoría", () => {
    const reglas = [promo({ scope: PromotionScope.CATEGORY, categoryIds: ["cat-1"] })];
    expect(promocionesDeProducto(reglas, { productId: "prod-1", categoryId: null }, MIERCOLES)).toEqual([]);
  });

  it("una promo que todavía no arrancó no se anuncia", () => {
    // Avisarla antes de tiempo haría que el dueño cargue el precio pensando que
    // ya está descontando.
    const reglas = [promo({ startsAt: new Date(2026, 8, 1) })];
    expect(promocionesDeProducto(reglas, alfajor, MIERCOLES)).toEqual([]);
  });

  it("una promo vencida tampoco", () => {
    const reglas = [promo({ endsAt: new Date(2026, 6, 30) })];
    expect(promocionesDeProducto(reglas, alfajor, MIERCOLES)).toEqual([]);
  });

  it("respeta los días de la semana", () => {
    // El 5/8/2026 es miércoles (día ISO 3).
    expect(promocionesDeProducto([promo({ weekdays: "3" })], alfajor, MIERCOLES)).toHaveLength(1);
    expect(promocionesDeProducto([promo({ weekdays: "1,2" })], alfajor, MIERCOLES)).toHaveLength(0);
  });

  it("primero la de mayor prioridad, que es la que se aplica antes", () => {
    const reglas = [
      promo({ id: "a", name: "Baja", priority: 0 }),
      promo({ id: "b", name: "Alta", priority: 10 }),
    ];
    expect(nombres(promocionesDeProducto(reglas, alfajor, MIERCOLES))).toEqual(["Alta", "Baja"]);
  });

  it("con prioridades empatadas el orden no baila entre renders", () => {
    const reglas = [promo({ id: "a", name: "Zeta" }), promo({ id: "b", name: "Alfa" })];
    expect(nombres(promocionesDeProducto(reglas, alfajor, MIERCOLES))).toEqual(["Alfa", "Zeta"]);
  });

  it("sin promos cargadas devuelve una lista vacía, no rompe", () => {
    expect(promocionesDeProducto([], alfajor, MIERCOLES)).toEqual([]);
  });
});
