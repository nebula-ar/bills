import { describe, expect, it } from "vitest";

import { checkRedeem, loyaltyBalance, loyaltyEnabled, pointsForSale, pointsValue, RedeemError } from "./loyalty.logic";

// $1.000 = 1 punto, y cada punto vale $50 al canjear.
const RULES = { pointsPerAmount: 1_000, pointValue: 50 };

describe("loyaltyEnabled", () => {
  it("hace falta configurar las dos cosas", () => {
    expect(loyaltyEnabled(RULES)).toBe(true);
    expect(loyaltyEnabled({ pointsPerAmount: 1_000, pointValue: null })).toBe(false);
    expect(loyaltyEnabled({ pointsPerAmount: null, pointValue: 50 })).toBe(false);
    expect(loyaltyEnabled({ pointsPerAmount: 0, pointValue: 50 })).toBe(false);
  });
});

describe("pointsForSale", () => {
  it("suma un punto cada mil pesos", () => {
    expect(pointsForSale(3_000, RULES)).toBe(3);
  });

  it("redondea para abajo: no se regalan fracciones", () => {
    expect(pointsForSale(3_999, RULES)).toBe(3);
  });

  it("una venta chica no suma nada", () => {
    expect(pointsForSale(900, RULES)).toBe(0);
  });

  it("sin programa configurado no suma", () => {
    expect(pointsForSale(10_000, { pointsPerAmount: null, pointValue: null })).toBe(0);
  });

  it("una venta en cero (o anulada) no suma", () => {
    expect(pointsForSale(0, RULES)).toBe(0);
    expect(pointsForSale(-5_000, RULES)).toBe(0);
  });
});

describe("loyaltyBalance", () => {
  it("el saldo es la suma del libro", () => {
    expect(loyaltyBalance([{ points: 10 }, { points: 5 }, { points: -8 }])).toBe(7);
  });

  it("sin movimientos, cero", () => {
    expect(loyaltyBalance([])).toBe(0);
  });
});

describe("pointsValue", () => {
  it("traduce puntos a pesos", () => {
    expect(pointsValue(20, RULES)).toBe(1_000);
  });

  it("un saldo negativo no vale plata", () => {
    expect(pointsValue(-5, RULES)).toBe(0);
  });
});

describe("checkRedeem", () => {
  it("deja canjear lo que tiene", () => {
    expect(checkRedeem(20, 50, RULES)).toEqual({ ok: true, points: 20, value: 1_000 });
  });

  it("no deja canjear más de lo que tiene: el saldo no va a negativo", () => {
    expect(checkRedeem(60, 50, RULES)).toEqual({ ok: false, error: RedeemError.NOT_ENOUGH_POINTS });
  });

  it("rechaza cantidades sin sentido", () => {
    expect(checkRedeem(0, 50, RULES)).toEqual({ ok: false, error: RedeemError.INVALID_POINTS });
    expect(checkRedeem(-3, 50, RULES)).toEqual({ ok: false, error: RedeemError.INVALID_POINTS });
    expect(checkRedeem(1.5, 50, RULES)).toEqual({ ok: false, error: RedeemError.INVALID_POINTS });
  });

  it("con el programa apagado no se canjea", () => {
    expect(checkRedeem(10, 50, { pointsPerAmount: null, pointValue: null })).toEqual({
      ok: false,
      error: RedeemError.DISABLED,
    });
  });

  it("justo el saldo entero se puede canjear", () => {
    expect(checkRedeem(50, 50, RULES)).toEqual({ ok: true, points: 50, value: 2_500 });
  });
});
