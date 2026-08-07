import { describe, expect, it } from "vitest";

import type { ExportSale } from "./export.use-case";
import {
  buildSalesTable,
  computePdfLayout,
  computePdfRowHeight,
  exportFilename,
  exportFormatsFor,
  formatExportCell,
  isExportDataset,
  isExportFormat,
  pdfColumnsFor,
  renderXlsx,
  SALES_EXPORT_COLUMNS,
} from "./export.use-case";

// Lee un workbook de exceljs desde un buffer y devuelve la primera hoja.
async function readXlsxSheet(buffer: Uint8Array) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);
  return workbook.worksheets[0];
}

// Una venta mínima para probar el armado de la tabla sin tocar la base.
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

describe("buildSalesTable", () => {
  it("arma las columnas de la planilla", () => {
    const table = buildSalesTable([makeSale()]);

    expect(table.columns.map((column) => column.header)).toEqual([
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

  it("una fila por ítem, con valores crudos (cantidad con su unidad)", () => {
    const table = buildSalesTable([makeSale()]);

    expect(table.rows[0]).toEqual([
      new Date(2026, 6, 5, 9, 7),
      "567890",
      "Local 1",
      "María",
      "Consumidor final",
      "",
      "Alfajor",
      { value: 2000, unit: "UNIT" },
      500,
      0,
      1000,
      300,
      600,
      "Efectivo 1000",
      1000,
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

    const table = buildSalesTable([sale]);

    expect(table.rows).toHaveLength(2);
    expect(table.rows[0][1]).toBe("567890");
    expect(table.rows[1][1]).toBe("567890");
    expect(table.rows[0][13]).toBe("Efectivo 500 + Mercado Pago 500");
  });
});

describe("formatExportCell", () => {
  it("formatea los importes con coma decimal para la planilla", () => {
    expect(formatExportCell({ header: "Importe", kind: "money" }, 12500)).toBe("12500,00");
  });

  it("formatea las cantidades con la unidad abreviada", () => {
    expect(formatExportCell({ header: "Cantidad", kind: "quantity" }, { value: 1250, unit: "KG" })).toBe("1,25 kg");
  });

  it("formatea las fechas al estilo argentino", () => {
    expect(formatExportCell({ header: "Fecha", kind: "datetime" }, new Date(2026, 6, 5, 9, 7))).toBe(
      "05/07/2026 09:07",
    );
  });

  it("deja vacía la celda sin valor", () => {
    expect(formatExportCell({ header: "CUIT/DNI", kind: "text" }, null)).toBe("");
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

describe("SALES_EXPORT_COLUMNS", () => {
  it("declara los kinds de cada columna de ventas", () => {
    const moneyColumns = SALES_EXPORT_COLUMNS.filter((column) => column.kind === "money").map(
      (column) => column.header,
    );

    expect(moneyColumns).toEqual([
      "Precio unitario",
      "Descuento",
      "Importe",
      "Costo unitario",
      "Costo del renglón",
      "Total de la venta",
    ]);
  });
});

describe("pdfColumnsFor", () => {
  it("ventas usa el subset legible en papel (no las 16 columnas)", () => {
    const table = buildSalesTable([makeSale()]);
    const columns = pdfColumnsFor("ventas", table);

    expect(columns.map((pdfColumn) => pdfColumn.column.header)).toEqual([
      "Fecha",
      "Venta",
      "Sucursal",
      "Vendedor",
      "Producto",
      "Cantidad",
      "Importe",
      "Medios de pago",
      "Total de la venta",
    ]);
  });

  it("los índices del subset apuntan a la fila completa", () => {
    const table = buildSalesTable([makeSale()]);
    const columns = pdfColumnsFor("ventas", table);
    const row = table.rows[0];

    // "Importe" (columna 10 de la planilla) lee el valor crudo correcto.
    const importe = columns.find((pdfColumn) => pdfColumn.column.header === "Importe");
    expect(importe?.sourceIndex).toBe(10);
    expect(row[importe!.sourceIndex]).toBe(1000);
  });

  it("el resto de los datasets usa todas las columnas en orden", () => {
    const table = buildSalesTable([makeSale()]);
    const columns = pdfColumnsFor("gastos", table);

    expect(columns).toHaveLength(table.columns.length);
    expect(columns[0].sourceIndex).toBe(0);
    expect(columns[columns.length - 1].sourceIndex).toBe(table.columns.length - 1);
  });
});

describe("renderXlsx", () => {
  it("escribe los importes como números sumables, no como texto", async () => {
    const table = buildSalesTable([makeSale()]);
    const buffer = await renderXlsx(table);
    const sheet = await readXlsxSheet(buffer);

    // La columna "Importe" es la 11 (1-based): debe ser number (type 2), no string.
    const importe = sheet.getRow(2).getCell(11);
    expect(importe.type).toBe(2);
    expect(importe.value).toBe(1000);
    expect(importe.numFmt).toBe("#,##0.00");
  });

  it("escribe las cantidades como números y el resto como texto", async () => {
    const table = buildSalesTable([makeSale()]);
    const buffer = await renderXlsx(table);
    const sheet = await readXlsxSheet(buffer);

    const cantidad = sheet.getRow(2).getCell(8); // "Cantidad"
    expect(cantidad.type).toBe(2);
    expect(cantidad.value).toBe(2000);

    const producto = sheet.getRow(2).getCell(7); // "Producto"
    expect(producto.type).toBe(3);
    expect(producto.value).toBe("Alfajor");
  });

  it("escribe la fecha como fecha nativa (ordenable) y no como texto", async () => {
    const table = buildSalesTable([makeSale()]);
    const buffer = await renderXlsx(table);
    const sheet = await readXlsxSheet(buffer);

    // La columna "Fecha" es la 1: debe ser una fecha real (type 4), no string.
    const fecha = sheet.getRow(2).getCell(1);
    expect(fecha.type).toBe(4);
    expect(fecha.value).toBeInstanceOf(Date);
    expect(fecha.numFmt).toBe("dd/mm/yyyy hh:mm");
  });
});

describe("computePdfLayout y computePdfRowHeight", () => {
  it("achica la fuente a más columnas", () => {
    expect(computePdfLayout(9).fontSize).toBe(7);
    expect(computePdfLayout(16).fontSize).toBe(6);
    expect(computePdfLayout(7).fontSize).toBe(9);
  });

  it("reparte el ancho de página entre las columnas", () => {
    const layout = computePdfLayout(9);
    expect(layout.columnWidth).toBeCloseTo((842 - 64) / 9);
    expect(layout.x(0)).toBeCloseTo(32);
    expect(layout.x(1)).toBeCloseTo(32 + layout.columnWidth);
  });

  it("la altura de fila cubre la celda más alta", () => {
    const table = buildSalesTable([makeSale()]);
    const pdfColumns = pdfColumnsFor("ventas", table);
    const layout = computePdfLayout(pdfColumns.length);

    const doc = { heightOfString: (_text: string, _opts: { width: number }) => 12 };
    const height = computePdfRowHeight(doc, layout, pdfColumns, table.rows[0]);

    expect(height).toBeGreaterThan(12);
    expect(height).toBeGreaterThan(layout.fontSize * 1.6);
  });
});
