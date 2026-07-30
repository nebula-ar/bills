// Código QR obligatorio en toda factura electrónica (RG 4291/2018).
// Especificación exacta leída del PDF oficial de ARCA:
// https://www.afip.gob.ar/fe/qr/documentos/QRespecificaciones.pdf
// Lógica pura: sin DB, se testea con Vitest.

export type AfipQrInput = {
  fecha: string; // "YYYY-MM-DD"
  cuit: string;
  ptoVta: number;
  tipoCmp: number; // CbteTipo (ver INVOICE_TYPE_CODES en invoice.ts)
  nroCmp: number; // afipVoucherNumber
  importe: number;
  docTipo: number; // DocTipo del receptor (ver resolveAfipDocument en tax-id.ts)
  docNro: number;
  cae: string;
};

const QR_BASE_URL = "https://www.arca.gob.ar/fe/qr/";

/** Arma la URL que codifica el QR del comprobante, según la spec oficial. */
export function buildAfipQrUrl(input: AfipQrInput): string {
  const payload = {
    ver: 1,
    fecha: input.fecha,
    cuit: Number(input.cuit),
    ptoVta: input.ptoVta,
    tipoCmp: input.tipoCmp,
    nroCmp: input.nroCmp,
    importe: input.importe,
    moneda: "PES",
    ctz: 1,
    tipoDocRec: input.docTipo,
    nroDocRec: input.docNro,
    tipoCodAut: "E", // autorizado por CAE (no CAEA)
    codAut: Number(input.cae),
  };
  const base64 = Buffer.from(JSON.stringify(payload)).toString("base64");
  return `${QR_BASE_URL}?p=${base64}`;
}
