import { describe, expect, it } from "vitest";

import { countVariants, generateVariants, parseAxisValues } from "./variants.logic";

describe("generateVariants", () => {
  it("combina talles y colores", () => {
    const variants = generateVariants("Remera lisa", [
      { name: "Talle", values: ["S", "M"] },
      { name: "Color", values: ["Negro", "Blanco"] },
    ]);

    expect(variants.map((variant) => variant.label)).toEqual([
      "S · Negro",
      "S · Blanco",
      "M · Negro",
      "M · Blanco",
    ]);
    expect(variants[0].name).toBe("Remera lisa S · Negro");
  });

  it("con un solo eje devuelve una variante por valor", () => {
    const variants = generateVariants("Jean", [{ name: "Talle", values: ["38", "40", "42"] }]);
    expect(variants).toHaveLength(3);
    expect(variants[2].name).toBe("Jean 42");
  });

  it("ignora ejes vacíos y valores en blanco", () => {
    const variants = generateVariants("Campera", [
      { name: "Talle", values: ["S", "  ", "M"] },
      { name: "Color", values: [] },
    ]);

    expect(variants.map((variant) => variant.label)).toEqual(["S", "M"]);
  });

  it("sin ejes no genera nada", () => {
    expect(generateVariants("Remera", [])).toEqual([]);
  });

  it("arma un sufijo de SKU sin acentos ni símbolos", () => {
    const variants = generateVariants("Buzo", [{ name: "Color", values: ["Marrón claro"] }]);
    expect(variants[0].skuSuffix).toBe("MARRONCLARO");
  });
});

describe("countVariants", () => {
  it("multiplica los ejes", () => {
    expect(countVariants([{ name: "Talle", values: ["S", "M", "L"] }, { name: "Color", values: ["A", "B"] }])).toBe(6);
  });

  it("un eje vacío no anula la cuenta", () => {
    expect(countVariants([{ name: "Talle", values: ["S", "M"] }, { name: "Color", values: [] }])).toBe(2);
  });
});

describe("parseAxisValues", () => {
  it("acepta coma, punto y coma y saltos de línea", () => {
    expect(parseAxisValues("S, M; L\nXL")).toEqual(["S", "M", "L", "XL"]);
  });

  it("descarta repetidos", () => {
    expect(parseAxisValues("S, M, S")).toEqual(["S", "M"]);
  });

  it("con texto vacío no devuelve nada", () => {
    expect(parseAxisValues("  ")).toEqual([]);
  });
});
