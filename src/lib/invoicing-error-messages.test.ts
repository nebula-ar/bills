import { describe, expect, it } from "vitest";

import { InvoicingErrorCode } from "@/modules/invoicing/invoicing.errors";

import { getInvoicingErrorMessage } from "./invoicing-error-messages";

describe("getInvoicingErrorMessage", () => {
  it("tiene mensaje en español para cada código de error", () => {
    for (const code of Object.values(InvoicingErrorCode)) {
      const message = getInvoicingErrorMessage(code);
      expect(message).toBeTruthy();
      // Sin placeholders sin resolver ni mensajes en inglés.
      expect(message).not.toMatch(/\{\{|\}\}|undefined|null/);
    }
  });

  it("INVOICE_ALREADY_ISSUED avisa que el comprobante ya se emitió", () => {
    expect(getInvoicingErrorMessage(InvoicingErrorCode.INVOICE_ALREADY_ISSUED)).toBe(
      "La venta ya tiene un comprobante emitido.",
    );
  });

  it("FISCAL_DATA_INCOMPLETE apunta a completar los datos fiscales", () => {
    expect(getInvoicingErrorMessage(InvoicingErrorCode.FISCAL_DATA_INCOMPLETE)).toBe(
      "Completá los datos fiscales del negocio antes de facturar.",
    );
  });
});
