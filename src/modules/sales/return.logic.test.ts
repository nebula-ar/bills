import { ONE } from "@/lib/quantity";
import { describe, expect, it } from "vitest";

import { paidForItem, pendingQuantity, quoteReturn, ReturnError, ReturnErrorCode } from "./return.logic";

function item(overrides: Partial<Parameters<typeof paidForItem>[0]> = {}) {
  return {
    saleItemId: "i1",
    description: "Remera",
    soldQuantity: 3 * ONE,
    returnedQuantity: 0,
    unitPrice: 10_000,
    discount: 0,
    ...overrides,
  };
}

describe("pendingQuantity", () => {
  it("descuenta lo ya devuelto", () => {
    expect(pendingQuantity(item({ returnedQuantity: ONE }))).toBe(2 * ONE);
  });

  it("nunca es negativo", () => {
    expect(pendingQuantity(item({ returnedQuantity: 5 * ONE }))).toBe(0);
  });
});

describe("paidForItem", () => {
  it("es el precio por la cantidad menos el descuento del renglón", () => {
    expect(paidForItem(item({ discount: 5000 }))).toBe(25_000);
  });
});

describe("quoteReturn", () => {
  it("devuelve la parte proporcional de lo pagado", () => {
    const quote = quoteReturn([item()], [{ saleItemId: "i1", quantity: ONE }]);

    expect(quote.total).toBe(10_000);
  });

  it("con descuento, devuelve lo pagado y no el precio de lista", () => {
    // 3 alfajores de $1.800 con 3x2: pagó $3.600. Devolver 1 son $1.200, no $1.800.
    const quote = quoteReturn(
      [item({ description: "Alfajor", soldQuantity: 3 * ONE, unitPrice: 1800, discount: 1800 })],
      [{ saleItemId: "i1", quantity: ONE }],
    );

    expect(quote.total).toBe(1200);
  });

  it("devolver todo el renglón devuelve exactamente lo pagado", () => {
    const quote = quoteReturn(
      [item({ soldQuantity: 3 * ONE, unitPrice: 333, discount: 111 })],
      [{ saleItemId: "i1", quantity: 3 * ONE }],
    );

    expect(quote.total).toBe(paidForItem(item({ soldQuantity: 3 * ONE, unitPrice: 333, discount: 111 })));
  });

  it("admite cantidades fraccionarias (medio kilo)", () => {
    const quote = quoteReturn(
      [item({ description: "Fiambre", soldQuantity: 1000, unitPrice: 12_000 })],
      [{ saleItemId: "i1", quantity: 500 }],
    );

    expect(quote.total).toBe(6000);
  });

  it("no deja devolver más de lo que queda", () => {
    expect(() =>
      quoteReturn([item({ returnedQuantity: 2 * ONE })], [{ saleItemId: "i1", quantity: 2 * ONE }]),
    ).toThrowError(ReturnError);

    try {
      quoteReturn([item({ returnedQuantity: 2 * ONE })], [{ saleItemId: "i1", quantity: 2 * ONE }]);
    } catch (error) {
      expect((error as ReturnError).code).toBe(ReturnErrorCode.EXCEEDS_SOLD);
      expect((error as ReturnError).detail?.available).toBe(ONE);
    }
  });

  it("ignora los renglones en cero y falla si no queda nada", () => {
    expect(() => quoteReturn([item()], [{ saleItemId: "i1", quantity: 0 }])).toThrowError(ReturnError);
  });

  it("rechaza un renglón que no es de esta venta", () => {
    expect(() => quoteReturn([item()], [{ saleItemId: "otro", quantity: ONE }])).toThrowError(ReturnError);
  });

  it("suma varios renglones", () => {
    const quote = quoteReturn(
      [item(), item({ saleItemId: "i2", description: "Jean", soldQuantity: ONE, unitPrice: 45_000 })],
      [
        { saleItemId: "i1", quantity: ONE },
        { saleItemId: "i2", quantity: ONE },
      ],
    );

    expect(quote.lines).toHaveLength(2);
    expect(quote.total).toBe(55_000);
  });
});
