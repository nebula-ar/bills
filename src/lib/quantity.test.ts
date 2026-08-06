import { Unit } from "@/generated/prisma/enums";
import { describe, expect, it } from "vitest";

import {
  formatQuantity,
  lineTotal,
  ONE,
  parseQuantityInput,
  sanitizeQuantityInput,
  wholeUnits,
} from "./quantity";

describe("parseQuantityInput", () => {
  it("interpreta enteros como unidades completas", () => {
    expect(parseQuantityInput("1")).toBe(1000);
    expect(parseQuantityInput("3")).toBe(3000);
  });

  it("acepta coma decimal en unidades fraccionarias", () => {
    expect(parseQuantityInput("1,250", Unit.KG)).toBe(1250);
    expect(parseQuantityInput("0,5", Unit.METER)).toBe(500);
  });

  it("rechaza fracciones en unidades que se venden enteras", () => {
    expect(parseQuantityInput("1,5", Unit.UNIT)).toBeNull();
    expect(parseQuantityInput("2,5", Unit.PACK)).toBeNull();
    expect(parseQuantityInput("2", Unit.UNIT)).toBe(2000);
  });

  it("rechaza vacío, texto, cero y negativos", () => {
    expect(parseQuantityInput("")).toBeNull();
    expect(parseQuantityInput("abc")).toBeNull();
    expect(parseQuantityInput("0")).toBeNull();
    expect(parseQuantityInput("-1")).toBeNull();
  });
});

describe("formatQuantity", () => {
  it("no muestra decimales cuando no hacen falta", () => {
    expect(formatQuantity(2000)).toBe("2");
    expect(formatQuantity(2000, Unit.UNIT)).toBe("2 un");
  });

  it("muestra solo los decimales significativos", () => {
    expect(formatQuantity(1250, Unit.KG)).toBe("1,25 kg");
    expect(formatQuantity(1500, Unit.KG)).toBe("1,5 kg");
    expect(formatQuantity(1005, Unit.KG)).toBe("1,005 kg");
  });
});

describe("lineTotal", () => {
  it("cobra el precio completo por unidad entera", () => {
    expect(lineTotal(9000, ONE)).toBe(9000);
    expect(lineTotal(9000, 3 * ONE)).toBe(27_000);
  });

  it("prorratea el precio por peso", () => {
    // 1,250 kg de tomate a $2.900 el kilo.
    expect(lineTotal(2900, 1250)).toBe(3625);
  });

  it("redondea a peso entero (no manejamos centavos)", () => {
    expect(lineTotal(333, 1500)).toBe(500);
    expect(lineTotal(2999, 333)).toBe(999);
  });
});

describe("wholeUnits", () => {
  it("cuenta hacia arriba: media unidad ya cuenta como una", () => {
    expect(wholeUnits(ONE)).toBe(1);
    expect(wholeUnits(1500)).toBe(2);
    expect(wholeUnits(3000)).toBe(3);
  });
});

describe("sanitizeQuantityInput", () => {
  it("saca las letras y deja los números", () => {
    // El que escribe "diez" ve el campo lleno y el botón apagado sin saber por
    // qué. Filtrando, el estado inválido no llega a existir.
    expect(sanitizeQuantityInput("diez", Unit.UNIT)).toBe("");
    expect(sanitizeQuantityInput("12 cajas", Unit.UNIT)).toBe("12");
    expect(sanitizeQuantityInput("a1b2c3", Unit.UNIT)).toBe("123");
  });

  it("saca símbolos y espacios", () => {
    expect(sanitizeQuantityInput("$ 12 -", Unit.UNIT)).toBe("12");
    expect(sanitizeQuantityInput("-5", Unit.UNIT)).toBe("5");
  });

  it("en algo que se vende por unidad no deja escribir decimales", () => {
    // "1,5 unidades" no es una cantidad, es un error de tipeo: media medialuna
    // no se vende ni se repone.
    expect(sanitizeQuantityInput("1,5", Unit.UNIT)).toBe("15");
    expect(sanitizeQuantityInput("1.5", Unit.UNIT)).toBe("15");
  });

  it("en lo que se vende por peso deja UN separador", () => {
    expect(sanitizeQuantityInput("1,5", Unit.KG)).toBe("1,5");
    expect(sanitizeQuantityInput("1.5", Unit.KG)).toBe("1.5");
    // El primero manda: sin esto queda escrito algo que después no se puede leer.
    expect(sanitizeQuantityInput("1,5,3", Unit.KG)).toBe("1,53");
    expect(sanitizeQuantityInput("1.5.3", Unit.KG)).toBe("1.53");
  });

  it("deja escribir el separador solo, para poder seguir tipeando", () => {
    // Al escribir "0,5" se pasa por "0,": cortarlo ahí haría imposible el paso.
    expect(sanitizeQuantityInput("0,", Unit.KG)).toBe("0,");
  });

  it("una cadena vacía sigue vacía", () => {
    expect(sanitizeQuantityInput("", Unit.KG)).toBe("");
  });

  it("lo que sale siempre lo entiende el parser, o es vacío", () => {
    // La garantía que hace útil al filtro: nada de lo que quede escrito puede
    // ser algo que después el parser rechace por su forma.
    for (const entrada of ["12", "abc", "1,5", "1.5.3", "$99", "-4", "0,5"]) {
      for (const unidad of [Unit.UNIT, Unit.KG]) {
        const limpio = sanitizeQuantityInput(entrada, unidad);
        if (limpio === "" || limpio.endsWith(",") || limpio.endsWith(".")) continue;
        expect(parseQuantityInput(limpio, unidad)).not.toBeNull();
      }
    }
  });
});
