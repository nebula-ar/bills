import { ProductKind } from "@/generated/prisma/enums";
import { describe, expect, it } from "vitest";

import {
  consumoDeProduccion,
  costoDeReceta,
  desglosarReceta,
  faltantesParaProducir,
  margenDeProducto,
  seVende,
  type RenglonDeReceta,
} from "./recipes";

/**
 * Recetas: qué ingrediente consume cada producto.
 *
 * Decisión de diseño: un ingrediente NO es un modelo aparte, es un Product con
 * `kind: INGREDIENT`. Un ingrediente ES un producto que no vendés — se le
 * compra a un proveedor, tiene stock, tiene costo y se desperdicia. Modelarlo
 * por separado obligaba a duplicar stock, movimientos, compras y proveedores
 * para expresar una sola diferencia: que no tiene precio de venta. Y en Bills
 * el precio ya vive en otra tabla, así que un producto sin fila de precio ya
 * es invendible.
 *
 * Las cantidades van en MILÉSIMAS, como todo el resto (ver src/lib/quantity.ts):
 * 120 = 0,12 kg de harina. Los costos, en pesos enteros.
 */

// Una medialuna: 0,12 kg de harina + 0,04 kg de manteca.
const MEDIALUNA: RenglonDeReceta[] = [
  { ingredienteId: "harina", cantidad: 120, costoPorUnidad: 2000 },
  { ingredienteId: "manteca", cantidad: 40, costoPorUnidad: 9000 },
];

describe("un ingrediente es un producto que no se vende", () => {
  it("la mercadería se vende; el ingrediente no", () => {
    expect(seVende(ProductKind.GOOD)).toBe(true);
    expect(seVende(ProductKind.SERVICE)).toBe(true);
    expect(seVende(ProductKind.INGREDIENT)).toBe(false);
  });

  it("es la única regla que hay que respetar en cada listado de venta", () => {
    // Sin esto, la harina aparece en el POS entre las medialunas. Es el precio
    // de reusar Product en vez de duplicar todo el stock, y por eso la regla
    // vive en UNA función y no repetida en cada consulta.
    const catalogo = [
      { kind: ProductKind.GOOD },
      { kind: ProductKind.INGREDIENT },
      { kind: ProductKind.SERVICE },
    ];

    expect(catalogo.filter((p) => seVende(p.kind))).toHaveLength(2);
  });
});

describe("cuánto cuesta hacer uno", () => {
  it("suma el costo de cada ingrediente por lo que lleva", () => {
    // harina: 2000/kg × 0,12 = 240 | manteca: 9000/kg × 0,04 = 360
    expect(costoDeReceta(MEDIALUNA)).toBe(600);
  });

  it("da entero: es lo que alimenta el margen de los reportes", () => {
    const costo = costoDeReceta([{ ingredienteId: "x", cantidad: 333, costoPorUnidad: 777 }]);

    expect(Number.isInteger(costo)).toBe(true);
  });

  it("un producto sin receta cuesta cero, no NaN", () => {
    // La mayoría no tiene receta cargada: una bebida se compra hecha.
    expect(costoDeReceta([])).toBe(0);
  });

  it("un ingrediente sin costo cargado no ensucia el total", () => {
    // Pasa cuando todavía no se registró ninguna compra de ese insumo.
    const costo = costoDeReceta([
      { ingredienteId: "harina", cantidad: 120, costoPorUnidad: 2000 },
      { ingredienteId: "sal", cantidad: 5, costoPorUnidad: null },
    ]);

    expect(costo).toBe(240);
  });
});

describe("producir consume", () => {
  it("hacer 10 medialunas consume 10 veces la receta", () => {
    const consumo = consumoDeProduccion(MEDIALUNA, 10);

    expect(consumo).toEqual([
      { ingredienteId: "harina", cantidad: 1200 },
      { ingredienteId: "manteca", cantidad: 400 },
    ]);
  });

  it("producir cero no consume nada", () => {
    expect(consumoDeProduccion(MEDIALUNA, 0)).toEqual([]);
  });

  it("no se produce una cantidad negativa", () => {
    // Sería una forma de INFLAR el stock de ingredientes sin comprarlos.
    expect(consumoDeProduccion(MEDIALUNA, -5)).toEqual([]);
  });
});

describe("¿alcanza el stock?", () => {
  const stock = { harina: 1000, manteca: 500 };

  it("con stock de sobra no falta nada", () => {
    expect(faltantesParaProducir(MEDIALUNA, 5, stock)).toEqual([]);
  });

  it("avisa CUÁNTO falta, no solo que falta", () => {
    // "No hay harina" no le sirve a nadie: el panadero necesita saber si le
    // faltan 200 gramos o 20 kilos para decidir qué hace.
    const faltantes = faltantesParaProducir(MEDIALUNA, 10, stock);

    expect(faltantes).toEqual([{ ingredienteId: "harina", falta: 200 }]);
  });

  it("un ingrediente sin stock registrado cuenta como cero", () => {
    // No es lo mismo "no hay" que "nunca se cargó", pero para producir sí.
    expect(faltantesParaProducir(MEDIALUNA, 1, {})).toEqual([
      { ingredienteId: "harina", falta: 120 },
      { ingredienteId: "manteca", falta: 40 },
    ]);
  });

  it("justo lo necesario alcanza", () => {
    expect(faltantesParaProducir(MEDIALUNA, 1, { harina: 120, manteca: 40 })).toEqual([]);
  });
});

describe("desglosarReceta", () => {
  const receta = [
    { ingredienteId: "harina", cantidad: 500, costoPorUnidad: 2000 },
    { ingredienteId: "manteca", cantidad: 100, costoPorUnidad: 8000 },
  ];

  it("dice cuánto pone cada insumo y qué parte del costo se lleva", () => {
    // El total dice cuánto sale; el desglose dice DÓNDE se va la plata, que es
    // lo que decide qué conviene negociar con el proveedor.
    const { renglones, total } = desglosarReceta(receta);
    expect(total).toBe(1800);
    expect(renglones.map((r) => [r.ingredienteId, r.costo, r.porcentaje])).toEqual([
      ["harina", 1000, 56],
      ["manteca", 800, 44],
    ]);
  });

  it("una receta vacía no divide por cero", () => {
    // Sin esto saldría NaN impreso en pantalla.
    expect(desglosarReceta([])).toEqual({ renglones: [], total: 0, sinCostear: 0 });
  });

  it("con todo en cero los porcentajes son cero, no NaN", () => {
    const { renglones, total } = desglosarReceta([
      { ingredienteId: "x", cantidad: 500, costoPorUnidad: 0 },
    ]);
    expect(total).toBe(0);
    expect(renglones[0].porcentaje).toBe(0);
  });

  it("marca los insumos sin costo y cuenta cuántos son", () => {
    // El total queda incompleto por esos: decirlo evita que alguien fije el
    // precio sobre un costo al que le falta la mitad.
    const { renglones, sinCostear, total } = desglosarReceta([
      { ingredienteId: "harina", cantidad: 500, costoPorUnidad: 2000 },
      { ingredienteId: "sal", cantidad: 10, costoPorUnidad: null },
    ]);
    expect(sinCostear).toBe(1);
    expect(renglones[1].sinCosto).toBe(true);
    expect(renglones[1].costo).toBe(0);
    expect(total).toBe(1000);
  });
});

describe("margenDeProducto", () => {
  it("saca la ganancia y el porcentaje sobre el precio", () => {
    // Sobre el precio, igual que en el resto de la app: "de cada 100 que
    // entran, cuántos quedan".
    expect(margenDeProducto(5000, 1800)).toEqual({ ganancia: 3200, porcentaje: 64 });
  });

  it("sin precio devuelve null y no cero", () => {
    // "0%" haría creer que se vende a pérdida; la verdad es que no hay precio.
    expect(margenDeProducto(null, 1800)).toBeNull();
    expect(margenDeProducto(0, 1800)).toBeNull();
  });

  it("vender por debajo del costo da margen negativo, no lo esconde", () => {
    expect(margenDeProducto(1000, 1800)).toEqual({ ganancia: -800, porcentaje: -80 });
  });
});
