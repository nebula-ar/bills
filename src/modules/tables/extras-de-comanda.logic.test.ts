import { describe, expect, it } from "vitest";

import { extrasDeComanda } from "./extras-de-comanda.logic";

const ONE = 1_000;

describe("extrasDeComanda", () => {
  it("suma lo que las opciones agregan, por unidad y por cantidad", () => {
    // Dos cafés con extra crema de $500 son $1.000, no $500. El delta es por
    // unidad: es lo que la mesa ya le mostró al cliente.
    const extras = extrasDeComanda([
      { productId: "cafe", quantity: 2 * ONE, opciones: [{ name: "Extra crema", priceDelta: 500 }] },
    ]);

    expect(extras.total).toBe(1_000);
    expect(extras.detalle).toEqual([{ name: "Extra crema", amount: 1_000 }]);
  });

  it("una cantidad fraccionaria reparte el extra igual que el precio", () => {
    // Medio kilo con un agregado de $1.000 el kilo suma $500. Se redondea con
    // la misma regla que el precio de la línea (ver lineTotal).
    const extras = extrasDeComanda([
      { productId: "queso", quantity: 500, opciones: [{ name: "Estacionado", priceDelta: 1_000 }] },
    ]);

    expect(extras.total).toBe(500);
  });

  it("junta el mismo agregado de renglones distintos", () => {
    // Al cajero le sirve saber "Extra queso $1.500", no verlo tres veces.
    const extras = extrasDeComanda([
      { productId: "pizza", quantity: ONE, opciones: [{ name: "Extra queso", priceDelta: 500 }] },
      { productId: "empanada", quantity: 2 * ONE, opciones: [{ name: "Extra queso", priceDelta: 500 }] },
    ]);

    expect(extras.detalle).toEqual([{ name: "Extra queso", amount: 1_500 }]);
    expect(extras.total).toBe(1_500);
  });

  it("los descuentos también cuentan, en negativo", () => {
    // "Sin jamón −$300" baja el total. Ignorarlo cobraría de más, que es peor
    // que cobrar de menos: el cliente lo reclama en el mostrador.
    const extras = extrasDeComanda([
      { productId: "sandwich", quantity: ONE, opciones: [{ name: "Sin jamón", priceDelta: -300 }] },
    ]);

    expect(extras.total).toBe(-300);
  });

  it("sin opciones no hay extra, y el total es cero, no null", () => {
    // El llamador pregunta `total !== 0` para decidir si avisa: un null ahí lo
    // rompe en la venta de mostrador, que nunca tiene opciones.
    expect(extrasDeComanda([{ productId: "cafe", quantity: ONE, opciones: [] }])).toEqual({
      total: 0,
      detalle: [],
    });
    expect(extrasDeComanda([])).toEqual({ total: 0, detalle: [] });
  });

  it("una opción de ajuste cero no ensucia el detalle", () => {
    // "Bien caliente" no cambia la plata: listarla en un aviso sobre dinero
    // hace dudar de si cobra algo.
    const extras = extrasDeComanda([
      { productId: "cafe", quantity: ONE, opciones: [{ name: "Bien caliente", priceDelta: 0 }] },
    ]);

    expect(extras).toEqual({ total: 0, detalle: [] });
  });
});
