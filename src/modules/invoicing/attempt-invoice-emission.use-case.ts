import { decryptBusinessCertificate } from "@/lib/crypto";
import { determineInvoiceType, isBusinessFiscallyConfigured } from "@/lib/invoice";
import { emitInvoice } from "@/lib/invoice-provider";
import { logEvent } from "@/lib/logger";
import { AfipStatus } from "@/generated/prisma/client";

import { findBusinessForInvoicing } from "../business/business.repository";
import { InvoicingError, InvoicingErrorCode } from "./invoicing.errors";
import { findSaleForInvoicing, markInvoiceFailed, markInvoiceIssued, markInvoiceNotConfigured } from "./invoicing.repository";

export type AttemptInvoiceEmissionInput = { saleId: string; businessId: string };
export type AttemptInvoiceEmissionResult = { ok: true } | { ok: false; error: string };

/**
 * Intenta emitir la factura AFIP/ARCA de una venta ya cobrada. Nunca se llama
 * dentro de la transacción de cobro — es una acción aparte, disparada a mano
 * desde el historial de ventas. Un fallo del proveedor nunca revierte la venta.
 */
export async function attemptInvoiceEmission(input: AttemptInvoiceEmissionInput): Promise<AttemptInvoiceEmissionResult> {
  const sale = await findSaleForInvoicing(input.saleId, input.businessId);
  if (!sale) {
    throw new InvoicingError(InvoicingErrorCode.SALE_NOT_FOUND);
  }

  // La UI solo ofrece emitir/reintentar para ventas no emitidas, pero el guard
  // tiene que vivir acá: un call directo no debe re-emitir contra AFIP (CAE
  // duplicado).
  if (sale.afipStatus === AfipStatus.ISSUED) {
    throw new InvoicingError(InvoicingErrorCode.INVOICE_ALREADY_ISSUED);
  }

  const business = await findBusinessForInvoicing(input.businessId);

  if (!business || !isBusinessFiscallyConfigured(business)) {
    await markInvoiceNotConfigured(sale.id, "Faltan datos fiscales del negocio");
    throw new InvoicingError(InvoicingErrorCode.FISCAL_DATA_INCOMPLETE);
  }

  const invoiceType = determineInvoiceType(business.taxCondition, sale.customerTaxCondition);
  if (!invoiceType) {
    throw new InvoicingError(InvoicingErrorCode.INVOICE_TYPE_UNRESOLVED);
  }

  try {
    const result = await emitInvoice({
      cuit: business.cuit!,
      salesPointNumber: business.salesPointNumber!,
      invoiceType,
      total: sale.total,
      customerTaxId: sale.customerTaxId,
      customerTaxCondition: sale.customerTaxCondition,
      certificate: decryptBusinessCertificate(business),
    });

    await markInvoiceIssued({
      saleId: sale.id,
      invoiceType,
      cae: result.cae,
      caeVencimiento: result.caeVencimiento,
      afipVoucherNumber: result.voucherNumber,
    });

    await logEvent("invoice.emit", `Factura ${invoiceType} emitida para venta ${sale.id}`, {
      businessId: input.businessId,
      context: { saleId: sale.id, invoiceType, cae: result.cae },
    });

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo emitir la factura";
    await markInvoiceFailed(sale.id, invoiceType, message);
    return { ok: false, error: message };
  }
}
