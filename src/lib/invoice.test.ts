import { describe, expect, it } from "vitest";

import { TaxCondition } from "@/generated/prisma/enums";

import { determineInvoiceType, isBusinessFiscallyConfigured } from "./invoice";

describe("isBusinessFiscallyConfigured", () => {
  it("true cuando están los tres datos", () => {
    expect(
      isBusinessFiscallyConfigured({
        cuit: "20409378472",
        taxCondition: TaxCondition.RESPONSABLE_INSCRIPTO,
        salesPointNumber: 1,
      }),
    ).toBe(true);
  });

  it("false si falta el CUIT", () => {
    expect(
      isBusinessFiscallyConfigured({
        cuit: null,
        taxCondition: TaxCondition.RESPONSABLE_INSCRIPTO,
        salesPointNumber: 1,
      }),
    ).toBe(false);
  });

  it("false si falta el punto de venta", () => {
    expect(
      isBusinessFiscallyConfigured({
        cuit: "20409378472",
        taxCondition: TaxCondition.RESPONSABLE_INSCRIPTO,
        salesPointNumber: null,
      }),
    ).toBe(false);
  });

  it("false si falta la condición de IVA", () => {
    expect(
      isBusinessFiscallyConfigured({
        cuit: "20409378472",
        taxCondition: null,
        salesPointNumber: 1,
      }),
    ).toBe(false);
  });
});

describe("determineInvoiceType", () => {
  it("Responsable Inscripto a Responsable Inscripto da factura A", () => {
    expect(determineInvoiceType(TaxCondition.RESPONSABLE_INSCRIPTO, TaxCondition.RESPONSABLE_INSCRIPTO)).toBe("A");
  });

  it("Responsable Inscripto a Consumidor Final da factura B", () => {
    expect(determineInvoiceType(TaxCondition.RESPONSABLE_INSCRIPTO, TaxCondition.CONSUMIDOR_FINAL)).toBe("B");
  });

  it("Monotributo siempre da factura C", () => {
    expect(determineInvoiceType(TaxCondition.MONOTRIBUTO, TaxCondition.RESPONSABLE_INSCRIPTO)).toBe("C");
    expect(determineInvoiceType(TaxCondition.MONOTRIBUTO, TaxCondition.CONSUMIDOR_FINAL)).toBe("C");
  });

  it("Exento siempre da factura C", () => {
    expect(determineInvoiceType(TaxCondition.EXENTO, TaxCondition.CONSUMIDOR_FINAL)).toBe("C");
  });

  it("emisor sin configurar da null", () => {
    expect(determineInvoiceType(null, TaxCondition.CONSUMIDOR_FINAL)).toBeNull();
  });

  it("emisor con una condición no válida para facturar (ej. Consumidor Final) da null", () => {
    expect(determineInvoiceType(TaxCondition.CONSUMIDOR_FINAL, TaxCondition.CONSUMIDOR_FINAL)).toBeNull();
  });
});
