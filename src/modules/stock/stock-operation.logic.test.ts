import { describe, expect, it } from "vitest";

import { Unit } from "@/generated/prisma/enums";

import { admiteComa, problemaDeCantidad, resultadoDeOperacion } from "./stock-operation.logic";

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

describe("problemaDeCantidad", () => {
  it("una coma en una unidad que no se fracciona se explica por lo que ES", () => {
    // El caso que justifica todo esto. El parser devuelve null para "2,5"
    // docenas, y la pantalla decía "tiene que ser un número mayor que cero",
    // que es MENTIRA: 2,5 es mayor que cero. El usuario corrige el signo, que
    // está bien, y vuelve a fallar.
    expect(problemaDeCantidad({ escrito: "2,5", unit: Unit.DOZEN })).toBe(
      "2,5 no se puede: se cuenta de a uno.",
    );
    expect(problemaDeCantidad({ escrito: "1,25", unit: Unit.UNIT })).toBe(
      "1,25 no se puede: se cuenta de a uno.",
    );
  });

  it("la misma coma en kilos es válida y no molesta", () => {
    expect(problemaDeCantidad({ escrito: "25,5", unit: Unit.KG })).toBeNull();
    expect(problemaDeCantidad({ escrito: "0,5", unit: Unit.LITER })).toBeNull();
  });

  it("el campo vacío no es un problema: todavía no escribió nada", () => {
    expect(problemaDeCantidad({ escrito: "", unit: Unit.KG })).toBeNull();
    expect(problemaDeCantidad({ escrito: "   ", unit: Unit.KG })).toBeNull();
  });

  it("contar cero es legítimo; recibir o perder cero, no", () => {
    // "Se acabó" es un conteo válido. Recibir cero no significa nada.
    expect(problemaDeCantidad({ escrito: "0", unit: Unit.UNIT, esConteo: true })).toBeNull();
    expect(problemaDeCantidad({ escrito: "0", unit: Unit.UNIT })).toBe(
      "Tiene que ser un número mayor que cero.",
    );
  });

  it("en un conteo el mensaje habla de contar", () => {
    expect(problemaDeCantidad({ escrito: "abc", unit: Unit.KG, esConteo: true })).toBe(
      "Escribí cuánto contaste.",
    );
  });

  it("el separador colgando se acepta: '1,' es 1", () => {
    // Documentado porque es contraintuitivo y lo probé al revés: `parseQuantityInput`
    // normaliza "1," a "1." y `Number("1.")` da 1, así que no es un error. Sirve:
    // el usuario que todavía está tipeando no ve un cartel rojo por la coma que
    // acaba de poner.
    expect(problemaDeCantidad({ escrito: "1,", unit: Unit.KG })).toBeNull();
    expect(problemaDeCantidad({ escrito: "1,", unit: Unit.UNIT })).toBeNull();
  });

  it("lo que no es un número sí se rechaza", () => {
    expect(problemaDeCantidad({ escrito: "abc", unit: Unit.KG })).toBe(
      "Tiene que ser un número mayor que cero.",
    );
  });
});

describe("admiteComa", () => {
  it("dice si el teclado tiene que ofrecer la coma", () => {
    // De acá sale el `inputMode` del campo. Ofrecer la coma donde el parser la
    // rechaza es invitar a tipear algo que se pierde.
    expect(admiteComa(Unit.KG)).toBe(true);
    expect(admiteComa(Unit.LITER)).toBe(true);
    expect(admiteComa(Unit.UNIT)).toBe(false);
    expect(admiteComa(Unit.DOZEN)).toBe(false);
    expect(admiteComa(Unit.PACK)).toBe(false);
  });
});
