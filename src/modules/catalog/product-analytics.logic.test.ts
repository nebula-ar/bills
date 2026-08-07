import { describe, expect, it } from "vitest";

import { analizarProducto, type RenglonVendido } from "./product-analytics.logic";

/**
 * Los números de un producto.
 *
 * Lo que se prueba es que no mientan de las tres maneras que importan: contando
 * lo devuelto como vendido, usando el costo de hoy para ventas viejas, y
 * dividiendo por cero cuando no hubo ventas.
 */

const vendido = (parcial: Partial<RenglonVendido> = {}): RenglonVendido => ({
  saleId: "v1",
  quantity: 1000,
  total: 1000,
  discount: 0,
  unitCost: 400,
  soldAt: new Date(2026, 7, 1),
  devuelto: { quantity: 0, amount: 0 },
  ...parcial,
});

const analizar = (vendidos: RenglonVendido[], extra = {}) =>
  analizarProducto({ vendidos, comprados: [], tirados: [], costoActual: null, ...extra });

describe("sin movimientos", () => {
  it("no inventa números ni divide por cero", () => {
    const a = analizar([]);
    expect(a.unidades).toBe(0);
    expect(a.facturado).toBe(0);
    expect(a.margen).toBe(0);
    // null y no 0: no es que el margen sea cero, es que no hay con qué medirlo.
    expect(a.margenPorcentaje).toBeNull();
    expect(a.ultimaVenta).toBeNull();
    expect(a.ultimoCosto).toBeNull();
  });
});

describe("ventas y margen", () => {
  it("suma unidades, facturado y costo congelado", () => {
    const a = analizar([
      vendido({ saleId: "v1", quantity: 2000, total: 2000, unitCost: 400 }),
      vendido({ saleId: "v2", quantity: 1000, total: 1000, unitCost: 500 }),
    ]);
    expect(a.unidades).toBe(3000);
    expect(a.facturado).toBe(3000);
    // 2 × 400 + 1 × 500. El costo de cada renglón es el que tenía ESE día.
    expect(a.costo).toBe(1300);
    expect(a.margen).toBe(1700);
  });

  it("el margen se mide sobre lo facturado, no sobre el costo", () => {
    // De cada 100 pesos que entran, cuántos quedan. Sobre el costo daría 150%
    // y en el mostrador nadie lee así.
    const a = analizar([vendido({ quantity: 1000, total: 1000, unitCost: 400 })]);
    expect(a.margenPorcentaje).toBe(60);
  });

  it("cuenta en cuántas ventas distintas apareció, no cuántos renglones", () => {
    // La misma venta puede tener el producto en dos renglones (uno con
    // modificadores y otro sin).
    const a = analizar([vendido({ saleId: "v1" }), vendido({ saleId: "v1" }), vendido({ saleId: "v2" })]);
    expect(a.ventas).toBe(2);
  });

  it("la última venta es la más reciente aunque lleguen desordenadas", () => {
    const a = analizar([
      vendido({ soldAt: new Date(2026, 7, 3) }),
      vendido({ soldAt: new Date(2026, 7, 9) }),
      vendido({ soldAt: new Date(2026, 7, 5) }),
    ]);
    expect(a.ultimaVenta).toEqual(new Date(2026, 7, 9));
  });

  it("un renglón sin costo congelado no rompe el cálculo", () => {
    // Pasa con mercadería cargada antes de que existiera el costeo.
    const a = analizar([vendido({ total: 1000, unitCost: null })]);
    expect(a.costo).toBe(0);
    expect(a.margen).toBe(1000);
  });

  it("cantidades fraccionarias costean proporcionalmente", () => {
    // Medio kilo a $400 el kilo son $200, no $400.
    const a = analizar([vendido({ quantity: 500, total: 600, unitCost: 400 })]);
    expect(a.costo).toBe(200);
  });
});

describe("devoluciones", () => {
  it("lo devuelto no cuenta como vendido", () => {
    // Vender veinte y que devuelvan quince no es haber vendido veinte:
    // contarlo entero infla unidades, facturado y margen a la vez.
    const a = analizar([
      vendido({ quantity: 3000, total: 3000, unitCost: 400, devuelto: { quantity: 1000, amount: 1000 } }),
    ]);
    expect(a.unidades).toBe(2000);
    expect(a.facturado).toBe(2000);
    expect(a.costo).toBe(800);
    expect(a.devueltas).toBe(1000);
    expect(a.devuelto).toBe(1000);
  });

  it("una venta devuelta entera no cuenta como venta", () => {
    const a = analizar([
      vendido({ saleId: "v1", quantity: 1000, total: 1000, devuelto: { quantity: 1000, amount: 1000 } }),
      vendido({ saleId: "v2", quantity: 1000, total: 1000 }),
    ]);
    expect(a.ventas).toBe(1);
    expect(a.unidades).toBe(1000);
  });
});

describe("compras y mermas", () => {
  it("suma lo comprado y toma el último costo pagado", () => {
    const a = analizar([], {
      comprados: [
        { quantity: 10_000, unitCost: 300, at: new Date(2026, 7, 1) },
        { quantity: 5_000, unitCost: 350, at: new Date(2026, 7, 8) },
      ],
    });
    expect(a.compradas).toBe(15_000);
    // 10 × 300 + 5 × 350.
    expect(a.gastadoEnCompras).toBe(4750);
    // El último es el más reciente por FECHA, no el último del array.
    expect(a.ultimoCosto).toBe(350);
  });

  it("el último costo no depende del orden en que llegan las compras", () => {
    const a = analizar([], {
      comprados: [
        { quantity: 1000, unitCost: 350, at: new Date(2026, 7, 8) },
        { quantity: 1000, unitCost: 300, at: new Date(2026, 7, 1) },
      ],
    });
    expect(a.ultimoCosto).toBe(350);
  });

  it("valoriza lo tirado al costo actual", () => {
    const a = analizar([], { tirados: [{ quantity: 2000 }, { quantity: 500 }], costoActual: 400 });
    expect(a.tiradas).toBe(2500);
    expect(a.perdidoEnMermas).toBe(1000);
  });

  it("sin costo cargado, la merma se cuenta pero no se valoriza", () => {
    // Mejor decir "se tiraron 3" que inventar un peso que no se sabe.
    const a = analizar([], { tirados: [{ quantity: 3000 }], costoActual: null });
    expect(a.tiradas).toBe(3000);
    expect(a.perdidoEnMermas).toBe(0);
  });
});
