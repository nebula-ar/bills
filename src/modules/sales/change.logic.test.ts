import { describe, expect, it } from "vitest";

import { changeFor, coversTotal, quickCashAmounts } from "./change.logic";

describe("changeFor", () => {
  it("devuelve la diferencia", () => {
    expect(changeFor(12_400, 20_000)).toBe(7_600);
  });

  it("pago justo, sin vuelto", () => {
    expect(changeFor(12_400, 12_400)).toBe(0);
  });

  it("si no alcanza no devuelve un vuelto negativo", () => {
    // Mostrar "-$2.400" al lado de la palabra vuelto sería peor que no mostrar
    // nada: el botón de cobrar se deshabilita y listo.
    expect(changeFor(12_400, 10_000)).toBe(0);
  });
});

describe("coversTotal", () => {
  it("alcanza justo", () => {
    expect(coversTotal(12_400, 12_400)).toBe(true);
  });

  it("no alcanza por un peso", () => {
    expect(coversTotal(12_400, 12_399)).toBe(false);
  });
});

describe("quickCashAmounts", () => {
  it("ofrece los redondeos del total y los billetes que alcanzan", () => {
    // $12.400 → el siguiente mil, el siguiente cinco mil, y el billete de 20.
    expect(quickCashAmounts(12_400)).toEqual([13_000, 15_000, 20_000]);
  });

  it("con un total chico ofrece los billetes de a mano", () => {
    expect(quickCashAmounts(1_800)).toEqual([2_000, 5_000, 10_000, 20_000]);
  });

  it("no ofrece un monto menor al total", () => {
    for (const amount of quickCashAmounts(7_300)) {
      expect(amount).toBeGreaterThan(7_300);
    }
  });

  it("no repite el mismo monto aunque coincidan dos reglas", () => {
    const amounts = quickCashAmounts(4_500);
    expect(new Set(amounts).size).toBe(amounts.length);
  });

  it("no ofrece el total justo como atajo: para eso está el botón aparte", () => {
    expect(quickCashAmounts(5_000)).not.toContain(5_000);
  });

  it("nunca ofrece más de cuatro, que es lo que entra en el ancho del celular", () => {
    expect(quickCashAmounts(900).length).toBeLessThanOrEqual(4);
  });

  it("sin total no hay atajos", () => {
    expect(quickCashAmounts(0)).toEqual([]);
  });
});
