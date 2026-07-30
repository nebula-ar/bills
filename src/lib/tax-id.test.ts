import { describe, expect, it } from "vitest";

import { resolveAfipDocument, validateTaxId } from "./tax-id";

describe("validateTaxId", () => {
  it("acepta un CUIT válido (dígito verificador correcto)", () => {
    // CUIT de prueba oficial de AFIP/AfipSDK para modo desarrollo.
    expect(validateTaxId("20409378472")).toEqual({ valid: true, kind: "CUIT" });
  });

  it("acepta un CUIT válido con guiones/espacios", () => {
    expect(validateTaxId("20-40937847-2")).toEqual({ valid: true, kind: "CUIT" });
    expect(validateTaxId(" 20 40937847 2 ")).toEqual({ valid: true, kind: "CUIT" });
  });

  it("rechaza un CUIT con dígito verificador incorrecto", () => {
    expect(validateTaxId("20409378479")).toEqual({ valid: false, kind: "CUIT" });
  });

  it("acepta un DNI de 7 u 8 dígitos", () => {
    expect(validateTaxId("1234567")).toEqual({ valid: true, kind: "DNI" });
    expect(validateTaxId("12345678")).toEqual({ valid: true, kind: "DNI" });
  });

  it("rechaza longitudes que no son CUIT ni DNI", () => {
    expect(validateTaxId("123")).toEqual({ valid: false, kind: null });
    expect(validateTaxId("123456")).toEqual({ valid: false, kind: null });
    expect(validateTaxId("123456789")).toEqual({ valid: false, kind: null });
  });

  it("rechaza string vacío", () => {
    expect(validateTaxId("")).toEqual({ valid: false, kind: null });
  });
});

describe("resolveAfipDocument", () => {
  it("CUIT válido da docTipo 80", () => {
    expect(resolveAfipDocument("20-40937847-2")).toEqual({ docTipo: 80, docNro: 20409378472 });
  });

  it("DNI da docTipo 96", () => {
    expect(resolveAfipDocument("12345678")).toEqual({ docTipo: 96, docNro: 12345678 });
  });

  it("sin dato o inválido da Consumidor Final (99/0)", () => {
    expect(resolveAfipDocument(null)).toEqual({ docTipo: 99, docNro: 0 });
    expect(resolveAfipDocument(undefined)).toEqual({ docTipo: 99, docNro: 0 });
    expect(resolveAfipDocument("")).toEqual({ docTipo: 99, docNro: 0 });
    expect(resolveAfipDocument("20409378479")).toEqual({ docTipo: 99, docNro: 0 }); // CUIT inválido
  });
});
