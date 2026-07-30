// Proveedor de facturación electrónica AFIP/ARCA. Usa el SDK oficial
// @afipsdk/afip.js contra el servicio de AfipSDK (maneja WSAA — Token/Sign —
// por nosotros, no hay que reimplementar esa parte).
//
// Requiere AFIPSDK_ACCESS_TOKEN en el entorno (cuenta gratis en
// https://app.afipsdk.com). Sin esa variable, rechaza con un mensaje claro —
// la venta nunca depende de esto (ver src/modules/invoicing/attempt-invoice-emission.use-case.ts,
// que llama a este módulo fuera de cualquier transacción de cobro).

import Afip from "@afipsdk/afip.js";

import { InvoiceType, TaxCondition } from "@/generated/prisma/client";

import { INVOICE_TYPE_CODES } from "./invoice";
import { resolveAfipDocument } from "./tax-id";

export type AfipCertificate = { cert: string; key: string };

export type InvoiceEmissionInput = {
  cuit: string;
  salesPointNumber: number;
  invoiceType: InvoiceType;
  total: number;
  customerTaxId?: string | null;
  customerTaxCondition?: TaxCondition;
  certificate?: AfipCertificate;
};

export type InvoiceEmissionResult = {
  cae: string;
  caeVencimiento: Date;
  voucherNumber: number;
};

// CondicionIVAReceptorId (RG 5616/2024, campo relativamente nuevo). Si AFIP/ARCA
// lo rechaza, verificar contra FEParamGetCondicionIvaReceptor.
const CONDICION_IVA_RECEPTOR_CODES: Record<TaxCondition, number> = {
  [TaxCondition.RESPONSABLE_INSCRIPTO]: 1,
  [TaxCondition.EXENTO]: 4,
  [TaxCondition.CONSUMIDOR_FINAL]: 5,
  [TaxCondition.MONOTRIBUTO]: 6,
  [TaxCondition.NO_RESPONSABLE]: 15,
};

type VoucherResult = { CAE: string; CAEFchVto: string; voucherNumber: number };

type TaxAmounts = {
  impNeto: number;
  impIVA: number;
  iva?: { Id: number; BaseImp: number; Importe: number }[];
};

/**
 * AFIP/ARCA exige el objeto `Iva` si `ImpNeto > 0` (error 10070 si falta —
 * confirmado contra el sandbox real). Monotributo (C) no discrimina IVA.
 * Para A/B, como esta app no trackea IVA por producto, se asume la alícuota
 * general (21%, Id 5 de FEParamGetTiposIva) sobre todo el total —
 * simplificación deliberada, misma filosofía que determineInvoiceType.
 */
function computeTaxAmounts(total: number, invoiceType: InvoiceType): TaxAmounts {
  if (invoiceType === "C") {
    return { impNeto: total, impIVA: 0 };
  }
  const impNeto = Math.round((total / 1.21) * 100) / 100;
  const impIVA = Math.round((total - impNeto) * 100) / 100;
  return { impNeto, impIVA, iva: [{ Id: 5, BaseImp: impNeto, Importe: impIVA }] };
}

function buildClient(cuit: string, certificate?: AfipCertificate): InstanceType<typeof Afip> {
  const accessToken = process.env.AFIPSDK_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error(
      "Falta configurar AFIPSDK_ACCESS_TOKEN (creá una cuenta gratis en https://app.afipsdk.com y pegá el token en .env).",
    );
  }
  return new Afip({
    CUIT: Number(cuit),
    access_token: accessToken,
    production: process.env.AFIPSDK_PRODUCTION === "true",
    ...(certificate ? { cert: certificate.cert, key: certificate.key } : {}),
  });
}

function toResult(v: VoucherResult): InvoiceEmissionResult {
  return {
    cae: v.CAE,
    caeVencimiento: new Date(v.CAEFchVto),
    voucherNumber: v.voucherNumber,
  };
}

export async function emitInvoice(input: InvoiceEmissionInput): Promise<InvoiceEmissionResult> {
  const afip = buildClient(input.cuit, input.certificate);
  const { docTipo, docNro } = resolveAfipDocument(input.customerTaxId ?? null);
  const condicionIvaReceptorId = CONDICION_IVA_RECEPTOR_CODES[input.customerTaxCondition ?? TaxCondition.CONSUMIDOR_FINAL];
  const amounts = computeTaxAmounts(input.total, input.invoiceType);

  const result: VoucherResult = await afip.ElectronicBilling.createNextVoucher({
    PtoVta: input.salesPointNumber,
    CbteTipo: INVOICE_TYPE_CODES[input.invoiceType],
    Concepto: 1, // Productos
    DocTipo: docTipo,
    DocNro: docNro,
    CbteFch: Number(formatAfipDate(new Date())),
    ImpTotal: input.total,
    ImpTotConc: 0,
    ImpNeto: amounts.impNeto,
    ImpOpEx: 0,
    ImpIVA: amounts.impIVA,
    ImpTrib: 0,
    MonId: "PES",
    MonCotiz: 1,
    CondicionIVAReceptorId: condicionIvaReceptorId,
    ...(amounts.iva ? { Iva: amounts.iva } : {}),
  });

  return toResult(result);
}

function formatAfipDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}
