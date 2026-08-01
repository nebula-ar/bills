import { describe, expect, it } from "vitest";

import { averageCostAfterEntry, averageCostAfterReversal, isEntryMovement } from "./costing.logic";

const ONE = 1000;

describe("averageCostAfterEntry", () => {
  it("promedia lo que había con lo que entra", () => {
    // 100 a $1.000 + 10 a $1.500 = 110 a $1.045,45 → $1.045
    const avg = averageCostAfterEntry({
      currentQuantity: 100 * ONE,
      currentAvgCost: 1_000,
      incomingQuantity: 10 * ONE,
      incomingUnitCost: 1_500,
    });

    expect(avg).toBe(1_045);
  });

  it("no infla el patrimonio como lo hacía el último costo", () => {
    const avg = averageCostAfterEntry({
      currentQuantity: 100 * ONE,
      currentAvgCost: 1_000,
      incomingQuantity: 10 * ONE,
      incomingUnitCost: 1_500,
    });

    // Lo que realmente se pagó por las 110 unidades.
    const pagado = 100 * 1_000 + 10 * 1_500;
    const valuado = Math.round((avg! * 110 * ONE) / 1000 / 1000) * 1000;

    expect(Math.abs(valuado - pagado)).toBeLessThanOrEqual(1_000);
    // Con último costo daría $165.000: $50.000 de patrimonio inventado.
    expect(valuado).toBeLessThan(120_000);
  });

  it("la primera compra fija el promedio", () => {
    expect(
      averageCostAfterEntry({ currentQuantity: 0, currentAvgCost: null, incomingQuantity: 5 * ONE, incomingUnitCost: 800 }),
    ).toBe(800);
  });

  it("si entra sin costo, el promedio no se toca", () => {
    expect(
      averageCostAfterEntry({
        currentQuantity: 10 * ONE,
        currentAvgCost: 900,
        incomingQuantity: 5 * ONE,
        incomingUnitCost: null,
      }),
    ).toBe(900);
  });

  it("sin ningún costo conocido devuelve null en vez de inventar uno", () => {
    expect(
      averageCostAfterEntry({ currentQuantity: 0, currentAvgCost: null, incomingQuantity: ONE, incomingUnitCost: null }),
    ).toBeNull();
  });

  it("con existencia en cero o negativa el promedio pasa a ser el de lo que entra", () => {
    expect(
      averageCostAfterEntry({ currentQuantity: 0, currentAvgCost: 900, incomingQuantity: 5 * ONE, incomingUnitCost: 1_200 }),
    ).toBe(1_200);

    // Se vendió sin stock: quedó en -3 y ahora entran 10.
    expect(
      averageCostAfterEntry({
        currentQuantity: -3 * ONE,
        currentAvgCost: 900,
        incomingQuantity: 10 * ONE,
        incomingUnitCost: 1_200,
      }),
    ).toBe(1_200);
  });

  it("funciona con fracciones (1,5 kg)", () => {
    // 2 kg a $1.000 + 1,5 kg a $2.000 = 3,5 kg a $1.428,57
    const avg = averageCostAfterEntry({
      currentQuantity: 2 * ONE,
      currentAvgCost: 1_000,
      incomingQuantity: 1_500,
      incomingUnitCost: 2_000,
    });

    expect(avg).toBe(1_429);
  });
});

describe("averageCostAfterReversal", () => {
  it("deshacer una compra deja el promedio como antes de esa compra", () => {
    const antes = 1_000;
    const despues = averageCostAfterEntry({
      currentQuantity: 100 * ONE,
      currentAvgCost: antes,
      incomingQuantity: 10 * ONE,
      incomingUnitCost: 1_500,
    });

    const revertido = averageCostAfterReversal({
      currentQuantity: 110 * ONE,
      currentAvgCost: despues,
      removedQuantity: 10 * ONE,
      removedUnitCost: 1_500,
    });

    // Vuelve a $1.000 salvo el redondeo de un peso del promedio.
    expect(Math.abs(revertido! - antes)).toBeLessThanOrEqual(1);
  });

  it("si al sacarla no queda nada, deja el promedio como estaba", () => {
    expect(
      averageCostAfterReversal({
        currentQuantity: 10 * ONE,
        currentAvgCost: 1_500,
        removedQuantity: 10 * ONE,
        removedUnitCost: 1_500,
      }),
    ).toBe(1_500);
  });

  it("no devuelve un promedio negativo aunque la cuenta dé absurda", () => {
    // Puede pasar si entre la compra y la anulación hubo ajustes a mano.
    const avg = averageCostAfterReversal({
      currentQuantity: 12 * ONE,
      currentAvgCost: 100,
      removedQuantity: 10 * ONE,
      removedUnitCost: 5_000,
    });

    expect(avg).toBe(100);
  });

  it("sin costo conocido no toca nada", () => {
    expect(
      averageCostAfterReversal({
        currentQuantity: 10 * ONE,
        currentAvgCost: null,
        removedQuantity: ONE,
        removedUnitCost: 900,
      }),
    ).toBeNull();
  });
});

describe("isEntryMovement", () => {
  it("las entradas recalculan el promedio", () => {
    expect(isEntryMovement("PURCHASE", 10 * ONE)).toBe(true);
    expect(isEntryMovement("INITIAL", 10 * ONE)).toBe(true);
    expect(isEntryMovement("RETURN", ONE)).toBe(true);
    expect(isEntryMovement("TRANSFER_IN", ONE)).toBe(true);
  });

  it("las salidas no lo tocan: sacan al promedio vigente", () => {
    expect(isEntryMovement("SALE", -ONE)).toBe(false);
    expect(isEntryMovement("LOSS", -ONE)).toBe(false);
    expect(isEntryMovement("TRANSFER_OUT", -ONE)).toBe(false);
    expect(isEntryMovement("PURCHASE_CANCELLED", -ONE)).toBe(false);
  });

  it("un ajuste por conteo cuenta como entrada solo si suma", () => {
    expect(isEntryMovement("ADJUSTMENT", 5 * ONE)).toBe(true);
    expect(isEntryMovement("ADJUSTMENT", -5 * ONE)).toBe(false);
  });
});
