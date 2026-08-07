import { describe, expect, it } from "vitest";

import { ProductKind, Unit, Vertical } from "@/generated/prisma/enums";

import { applySeedSelection } from "./preset-catalog";
import { presetCatalogFor } from "./preset-catalog";

const CATALOGO = [
  { name: "Banana", price: 2400, category: "Frutas", kind: ProductKind.GOOD, unit: Unit.KG },
  { name: "Tomate", price: 2900, category: "Verduras", kind: ProductKind.GOOD, unit: Unit.KG },
  { name: "Acelga", price: 1500, category: "Verduras", kind: ProductKind.GOOD, unit: Unit.UNIT },
];

describe("applySeedSelection", () => {
  it("sin selección entra el catálogo entero", () => {
    expect(applySeedSelection(CATALOGO)).toEqual(CATALOGO);
  });

  it("deja solo lo elegido", () => {
    const resultado = applySeedSelection(CATALOGO, [{ name: "Banana" }, { name: "Acelga" }]);

    expect(resultado.map((item) => item.name)).toEqual(["Banana", "Acelga"]);
  });

  it("una selección vacía no crea nada", () => {
    expect(applySeedSelection(CATALOGO, [])).toEqual([]);
  });

  // El orden lo manda el catálogo, no el cliente: así lo que se crea es
  // reproducible sin importar cómo llegue la lista.
  it("respeta el orden del catálogo", () => {
    const resultado = applySeedSelection(CATALOGO, [{ name: "Acelga" }, { name: "Banana" }]);

    expect(resultado.map((item) => item.name)).toEqual(["Banana", "Acelga"]);
  });

  it("toma el precio que puso el negocio", () => {
    const resultado = applySeedSelection(CATALOGO, [{ name: "Banana", price: 3100 }]);

    expect(resultado[0]).toMatchObject({ price: 3100 });
  });

  it("guarda la existencia que declaró el negocio", () => {
    const resultado = applySeedSelection(CATALOGO, [{ name: "Banana", stock: 12 }]);

    expect(resultado[0]).toMatchObject({ stock: 12 });
  });

  // Sin existencia declarada NO se asienta ninguna: un movimiento INITIAL es el
  // libro diciendo que entró mercadería, y si nadie la contó, no entró.
  it("sin existencia declarada no siembra ninguna", () => {
    expect(applySeedSelection(CATALOGO, [{ name: "Banana" }])[0].stock).toBeUndefined();
    expect(applySeedSelection(CATALOGO, [{ name: "Banana", stock: 0 }])[0].stock).toBeUndefined();
  });

  describe("lo que llega del cliente no se cree", () => {
    it("ignora nombres que no están en el catálogo del rubro", () => {
      const resultado = applySeedSelection(CATALOGO, [{ name: "Cocaína" }, { name: "Banana" }]);

      expect(resultado.map((item) => item.name)).toEqual(["Banana"]);
    });

    // El resto del producto —categoría, unidad, si es mercadería— sale del
    // catálogo del servidor. El cliente solo elige y pone números.
    it("reconstruye el producto desde el catálogo, no desde el cliente", () => {
      const resultado = applySeedSelection(CATALOGO, [{ name: "Acelga", price: 1800 }]);

      expect(resultado[0]).toMatchObject({
        name: "Acelga",
        category: "Verduras",
        unit: Unit.UNIT,
        kind: ProductKind.GOOD,
        price: 1800,
      });
    });

    it("descarta precios que no son un entero positivo y deja el sugerido", () => {
      for (const price of [0, -100, 12.5, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(applySeedSelection(CATALOGO, [{ name: "Banana", price }])[0]).toMatchObject({ price: 2400 });
      }
    });

    it("descarta existencias que no son un entero positivo", () => {
      for (const stock of [-5, 3.7, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(applySeedSelection(CATALOGO, [{ name: "Banana", stock }])[0].stock).toBeUndefined();
      }
    });

    it("no deja duplicar un producto repitiéndolo en la selección", () => {
      const resultado = applySeedSelection(CATALOGO, [{ name: "Banana" }, { name: "Banana", price: 9999 }]);

      expect(resultado).toHaveLength(1);
    });
  });

  it("funciona sobre el catálogo real de verdulería", () => {
    const completo = presetCatalogFor(Vertical.GROCERY);
    const elegidos = applySeedSelection(completo, [{ name: "Banana" }, { name: "Tomate", price: 3500, stock: 20 }]);

    expect(elegidos).toHaveLength(2);
    expect(elegidos.find((item) => item.name === "Tomate")).toMatchObject({ price: 3500, stock: 20, unit: Unit.KG });
  });
});
