import { describe, expect, it } from "vitest";

import { formatAmountInput, parseAmountInput } from "./money";

describe("parseAmountInput", () => {
  it("parsea enteros simples", () => {
    expect(parseAmountInput("1000")).toBe(1000);
    expect(parseAmountInput("0")).toBe(0);
  });

  it("trata el punto como separador de miles (es-AR)", () => {
    expect(parseAmountInput("1.000")).toBe(1000);
    expect(parseAmountInput("1.234.567")).toBe(1234567);
    expect(parseAmountInput("15.000")).toBe(15000);
  });

  it("recorta espacios", () => {
    expect(parseAmountInput("  2500  ")).toBe(2500);
  });

  it("rechaza vacío o no numérico", () => {
    expect(parseAmountInput("")).toBeNull();
    expect(parseAmountInput("   ")).toBeNull();
    expect(parseAmountInput("abc")).toBeNull();
    expect(parseAmountInput("$1000")).toBeNull();
  });

  it("rechaza centavos escritos con coma (guardamos enteros)", () => {
    expect(parseAmountInput("10,5")).toBeNull();
    expect(parseAmountInput("1500,99")).toBeNull();
  });

  it("el punto siempre es separador de miles, nunca decimal", () => {
    // Contrato es-AR: "1.000" son mil, no uno. Los campos de monto solo dejan
    // tipear dígitos, así que no llegan decimales con punto en uso normal.
    expect(parseAmountInput("1.000")).toBe(1000);
  });

  it("devuelve el entero aunque sea negativo (el signo lo valida cada caso)", () => {
    expect(parseAmountInput("-5")).toBe(-5);
  });
});

describe("formatAmountInput", () => {
  it("agrupa de a tres con punto", () => {
    expect(formatAmountInput("28000")).toBe("28.000");
    expect(formatAmountInput("1234567")).toBe("1.234.567");
  });

  it("no toca lo que ya está corto", () => {
    expect(formatAmountInput("999")).toBe("999");
    expect(formatAmountInput("0")).toBe("0");
  });

  it("es idempotente: se le puede pasar lo que ya mostró", () => {
    expect(formatAmountInput(formatAmountInput("1234567"))).toBe("1.234.567");
  });

  it("ignora todo lo que no sea dígito", () => {
    expect(formatAmountInput("$ 28.000")).toBe("28.000");
    expect(formatAmountInput("abc")).toBe("");
    expect(formatAmountInput("")).toBe("");
  });

  it("se come los ceros a la izquierda", () => {
    expect(formatAmountInput("0028")).toBe("28");
  });

  it("lo que muestra vuelve al mismo entero", () => {
    expect(parseAmountInput(formatAmountInput("28000"))).toBe(28000);
  });
});
