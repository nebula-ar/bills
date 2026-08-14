import { describe, expect, it } from "vitest";

import { SaleErrorCode } from "@/modules/sales/sale.errors";

import { getSaleErrorMessage } from "./sale-error-messages";

describe("getSaleErrorMessage", () => {
  it("tiene mensaje en español para cada código de error", () => {
    for (const code of Object.values(SaleErrorCode)) {
      const message = getSaleErrorMessage(code);
      expect(message).toBeTruthy();
      // Sin placeholders sin resolver ni mensajes en inglés.
      expect(message).not.toMatch(/\{\{|\}\}|undefined|null/);
    }
  });

  it("SALE_HAS_ISSUED_INVOICE explica que hace falta una nota de crédito", () => {
    expect(getSaleErrorMessage(SaleErrorCode.SALE_HAS_ISSUED_INVOICE)).toBe(
      "La venta ya tiene un comprobante emitido: para anularlo hace falta una nota de crédito, que todavía no está disponible.",
    );
  });
});
