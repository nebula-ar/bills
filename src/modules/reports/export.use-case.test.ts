import { describe, expect, it } from "vitest";

import type { ExportSale } from "./export.use-case";
import { buildSalesRows, exportFilename, exportFormatsFor, isExportDataset, isExportFormat } from "./export.use-case";

// Una venta mínima para probar el armado de filas sin tocar la base.
function makeSale(overrides: Partial<ExportSale> = {}): ExportSale {
  return {
    id: "clx1234567890",
    soldAt: new Date(2026, 6, 5, 9, 7),
    subtotal: 1000,
    discountTotal: 0,
    total: 1000,
    customerName: null,
    customerTaxId: null,
    cae: null,
    branch: { name: "Local 1" },
    staff: { name: "María" },
    customer: null,
    items: [
      { description: "Alfajor", quantity: 2000, unit: "UNIT", unitPrice: 500, discount: 0, total: 1000, unitCost: 300 },
    ],
    payments: [{ method: "CASH", amount: 1000 }],
    ...overrides,
  };
}

describe("buildSalesRows", () => {
  it("arma el encabezado de la planilla", () => {
    const rows = buildSalesRows([makeSale()]);

    expect(rows[0]).toEqual([
      "Fecha",
      "Venta",
      "Sucursal",
      "Vendedor",
      "Cliente",
      "CUIT/DNI",
      "Producto",
      "Cantidad",
      "Precio unitario",
      "Descuento",
      "Importe",
      "Costo unitario",
      "Costo del renglón",
      "Medios de pago",
      "Total de la venta",
      "CAE",
    ]);
  });

  it("una fila por ítem, con el costo del renglón y el método de pago", () => {
    const rows = buildSalesRows([makeSale()]);

    expect(rows[1]).toEqual([
      "05/07/2026 09:07",
      "567890",
      "Local 1",
      "María",
      "Consumidor final",
      "",
      "Alfajor",
      "2 un",
      "500,00",
      "0,00",
      "1000,00",
      "300,00",
      "600,00",
      "Efectivo 1000",
      "1000,00",
      "",
    ]);
  });

  it("repite la venta por cada ítem y suma los medios de pago", () => {
    const sale = makeSale({
      payments: [
        { method: "CASH", amount: 500 },
        { method: "MERCADO_PAGO", amount: 500 },
      ],
      items: [
        { description: "Alfajor", quantity: 1000, unit: "UNIT", unitPrice: 500, discount: 0, total: 500, unitCost: 300 },
        { description: "Gaseosa", quantity: 1000, unit: "UNIT", unitPrice: 500, discount: 0, total: 500, unitCost: 200 },
      ],
    });

    const rows = buildSalesRows([sale]);

    expect(rows).toHaveLength(3);
    expect(rows[1][1]).toBe("567890");
    expect(rows[2][1]).toBe("567890");
    expect(rows[1][13]).toBe("Efectivo 500 + Mercado Pago 500");
  });
});

describe("exportFilename", () => {
  it("nombra el CSV con el rango y la extensión csv", () => {
    expect(exportFilename("ventas", new Date(2026, 6, 1), new Date(2026, 6, 31), "csv")).toBe(
      "ventas-2026-07-01_a_2026-07-31.csv",
    );
  });

  it("usa la extensión xlsx para Excel", () => {
    expect(exportFilename("ventas", new Date(2026, 6, 1), new Date(2026, 6, 31), "xlsx")).toBe(
      "ventas-2026-07-01_a_2026-07-31.xlsx",
    );
  });

  it("usa la extensión pdf para PDF", () => {
    expect(exportFilename("ventas", new Date(2026, 6, 1), new Date(2026, 6, 31), "pdf")).toBe(
      "ventas-2026-07-01_a_2026-07-31.pdf",
    );
  });
});

describe("formatos por dataset", () => {
  it("ventas sale en CSV, Excel y PDF", () => {
    expect(exportFormatsFor("ventas")).toEqual(["csv", "xlsx", "pdf"]);
  });

  it("el resto sale solo en CSV", () => {
    expect(exportFormatsFor("gastos")).toEqual(["csv"]);
    expect(exportFormatsFor("compras")).toEqual(["csv"]);
    expect(exportFormatsFor("inventario")).toEqual(["csv"]);
  });

  it("valida datasets y formatos", () => {
    expect(isExportDataset("ventas")).toBe(true);
    expect(isExportDataset("venta")).toBe(false);
    expect(isExportFormat("xlsx")).toBe(true);
    expect(isExportFormat("docx")).toBe(false);
  });
});
