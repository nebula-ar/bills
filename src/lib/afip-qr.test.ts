import { describe, expect, it } from "vitest";

import { buildAfipQrUrl } from "./afip-qr";

function decode(url: string) {
  const p = new URL(url).searchParams.get("p")!;
  return JSON.parse(Buffer.from(p, "base64").toString("utf8"));
}

describe("buildAfipQrUrl", () => {
  it("arma la URL con el prefijo oficial de ARCA", () => {
    const url = buildAfipQrUrl({
      fecha: "2026-07-19",
      cuit: "20409378472",
      ptoVta: 1,
      tipoCmp: 6,
      nroCmp: 1089,
      importe: 90100,
      docTipo: 99,
      docNro: 0,
      cae: "86290598109027",
    });
    expect(url.startsWith("https://www.arca.gob.ar/fe/qr/?p=")).toBe(true);
  });

  it("codifica todos los campos correctamente (venta a consumidor final)", () => {
    const url = buildAfipQrUrl({
      fecha: "2026-07-19",
      cuit: "20409378472",
      ptoVta: 1,
      tipoCmp: 6,
      nroCmp: 1089,
      importe: 90100,
      docTipo: 99,
      docNro: 0,
      cae: "86290598109027",
    });
    expect(decode(url)).toEqual({
      ver: 1,
      fecha: "2026-07-19",
      cuit: 20409378472,
      ptoVta: 1,
      tipoCmp: 6,
      nroCmp: 1089,
      importe: 90100,
      moneda: "PES",
      ctz: 1,
      tipoDocRec: 99,
      nroDocRec: 0,
      tipoCodAut: "E",
      codAut: 86290598109027,
    });
  });

  it("codifica el documento del receptor cuando tiene CUIT (factura A)", () => {
    const url = buildAfipQrUrl({
      fecha: "2026-07-19",
      cuit: "20409378472",
      ptoVta: 1,
      tipoCmp: 1,
      nroCmp: 5,
      importe: 5000,
      docTipo: 80,
      docNro: 20409378472,
      cae: "71279638679871",
    });
    const decoded = decode(url);
    expect(decoded.tipoCmp).toBe(1);
    expect(decoded.tipoDocRec).toBe(80);
    expect(decoded.nroDocRec).toBe(20409378472);
  });
});
