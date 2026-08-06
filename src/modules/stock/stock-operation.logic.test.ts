import { describe, expect, it } from "vitest";

import { resultadoDeOperacion } from "./stock-operation.logic";

/**
 * La vista previa del movimiento de stock.
 *
 * Lo que se prueba es la diferencia que la pantalla no explicaba: contar FIJA la
 * existencia, recibir y perder la mueven. Escribir el mismo número en una o en
 * otra deja resultados distintos, y esta cuenta es la que lo hace visible antes
 * de confirmar.
 */

describe("contar (lo que hay de verdad)", () => {
  it("deja la existencia en lo contado, no lo suma", () => {
    // Había 11, contaste 9: quedan 9. Si sumara, quedarían 20.
    expect(resultadoDeOperacion("adjust", 11_000, 9_000)).toEqual({
      queda: 9_000,
      cambio: -2_000,
      recortado: false,
    });
  });

  it("contar más de lo que figuraba también corrige, hacia arriba", () => {
    expect(resultadoDeOperacion("adjust", 5_000, 8_000)).toEqual({
      queda: 8_000,
      cambio: 3_000,
      recortado: false,
    });
  });

  it("contar cero es legítimo: se acabó", () => {
    expect(resultadoDeOperacion("adjust", 4_000, 0)).toEqual({
      queda: 0,
      cambio: -4_000,
      recortado: false,
    });
  });

  it("contar lo mismo no mueve nada", () => {
    expect(resultadoDeOperacion("adjust", 7_000, 7_000).cambio).toBe(0);
  });
});

describe("llegó mercadería", () => {
  it("suma a lo que había", () => {
    expect(resultadoDeOperacion("receive", 11_000, 12_000)).toEqual({
      queda: 23_000,
      cambio: 12_000,
      recortado: false,
    });
  });

  it("recibir sobre cero arranca la existencia", () => {
    expect(resultadoDeOperacion("receive", 0, 6_000).queda).toBe(6_000);
  });
});

describe("se perdió", () => {
  it("resta de lo que había", () => {
    expect(resultadoDeOperacion("loss", 11_000, 3_000)).toEqual({
      queda: 8_000,
      cambio: -3_000,
      recortado: false,
    });
  });

  it("perder más de lo que hay deja en cero y avisa que no entró entero", () => {
    // No se pueden romper doce si había once. Sin el aviso, el usuario cree que
    // se descontaron doce y el faltante queda escondido.
    expect(resultadoDeOperacion("loss", 11_000, 12_000)).toEqual({
      queda: 0,
      cambio: -11_000,
      recortado: true,
    });
  });

  it("perder todo lo que hay no se considera recortado", () => {
    expect(resultadoDeOperacion("loss", 11_000, 11_000)).toEqual({
      queda: 0,
      cambio: -11_000,
      recortado: false,
    });
  });
});

describe("el mismo número da resultados distintos según la operación", () => {
  it("es exactamente la confusión que la vista previa evita", () => {
    const actual = 11_000;
    const escrito = 9_000;
    expect(resultadoDeOperacion("adjust", actual, escrito).queda).toBe(9_000);
    expect(resultadoDeOperacion("receive", actual, escrito).queda).toBe(20_000);
    expect(resultadoDeOperacion("loss", actual, escrito).queda).toBe(2_000);
  });
});

describe("cantidades fraccionarias", () => {
  it("funcionan igual: medio kilo que llega son 500 milésimas", () => {
    expect(resultadoDeOperacion("receive", 1_500, 500)).toEqual({
      queda: 2_000,
      cambio: 500,
      recortado: false,
    });
  });
});
