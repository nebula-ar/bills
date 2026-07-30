import { describe, expect, it } from "vitest";

import { topPairs } from "./basket.logic";

describe("topPairs", () => {
  it("encuentra lo que se lleva junto", () => {
    const sales = [
      { productIds: ["shampoo", "cera"] },
      { productIds: ["shampoo", "cera"] },
      { productIds: ["shampoo", "cera"] },
      { productIds: ["shampoo"] },
      { productIds: ["gaseosa"] },
    ];

    const [par] = topPairs(sales);

    expect(par).toMatchObject({ a: "cera", b: "shampoo", together: 3 });
    // De las 4 veces que se vendió shampoo (el más popular), 3 fue con cera.
    expect(par.confidence).toBe(75);
  });

  it("ignora la casualidad: un solo ticket junto no dice nada", () => {
    expect(topPairs([{ productIds: ["a", "b"] }])).toEqual([]);
  });

  it("el mínimo se puede bajar para un negocio con pocas ventas", () => {
    expect(topPairs([{ productIds: ["a", "b"] }], { minTogether: 1 })).toHaveLength(1);
  });

  it("un producto repetido en el mismo ticket cuenta una vez", () => {
    // Dos alfajores y una gaseosa es UN ticket con los dos productos, no dos.
    const pairs = topPairs([{ productIds: ["alfajor", "alfajor", "gaseosa"] }], { minTogether: 1 });

    expect(pairs).toHaveLength(1);
    expect(pairs[0].together).toBe(1);
  });

  it("cuenta cada par una sola vez, sin importar el orden del ticket", () => {
    const pairs = topPairs([{ productIds: ["b", "a"] }, { productIds: ["a", "b"] }], { minTogether: 1 });

    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ a: "a", b: "b", together: 2 });
  });

  it("ordena por cuántas veces se vendieron juntos y respeta el límite", () => {
    const sales = [
      ...Array.from({ length: 5 }, () => ({ productIds: ["a", "b"] })),
      ...Array.from({ length: 3 }, () => ({ productIds: ["c", "d"] })),
      ...Array.from({ length: 4 }, () => ({ productIds: ["e", "f"] })),
    ];

    expect(topPairs(sales, { limit: 2 }).map((pair) => pair.together)).toEqual([5, 4]);
  });

  it("un ticket de un solo ítem no arma pares", () => {
    expect(topPairs([{ productIds: ["a"] }, { productIds: ["b"] }], { minTogether: 1 })).toEqual([]);
  });
});
