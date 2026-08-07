import { EXPENSE_CATEGORY_LABELS } from "@/lib/expense-labels";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-labels";
import { prisma } from "@/lib/prisma";
import { formatQuantity } from "@/lib/quantity";

import { csvDate, csvDateTime, csvMoney, toCsv } from "./csv.logic";

// Exportar para el contador.
//
// Una fila por ítem y no por venta: el contador necesita ver qué se vendió, y
// una venta con cinco renglones colapsada en una línea no le sirve para nada.
// El número de venta se repite en cada fila para que pueda agrupar en la
// planilla.
//
// Los tres formatos comparten las mismas filas: el CSV lo arma `csv.logic`, el
// Excel usa `exceljs` (hoja con la misma grilla) y el PDF una tabla simple con
// `pdfkit`. Solo ventas sale en más de un formato.

export type ExportDataset = "ventas" | "gastos" | "compras" | "inventario";
export type ExportFormat = "csv" | "xlsx" | "pdf";

export const EXPORT_DATASETS: { value: ExportDataset; label: string; hint: string; formats: ExportFormat[] }[] = [
  {
    value: "ventas",
    label: "Ventas",
    hint: "Una fila por producto vendido, con costo y margen",
    // El contador pide ventas en planilla editable o en papel: CSV, Excel o PDF.
    formats: ["csv", "xlsx", "pdf"],
  },
  { value: "gastos", label: "Gastos", hint: "Qué se gastó, de qué cuenta salió y en qué rubro", formats: ["csv"] },
  { value: "compras", label: "Compras", hint: "Facturas de proveedores con su estado de pago", formats: ["csv"] },
  // Sin la existencia final el contador no puede cerrar el ejercicio: le falta
  // justo la mitad que la compra dejó en la góndola.
  { value: "inventario", label: "Inventario", hint: "Existencia final valuada, para cerrar el ejercicio", formats: ["csv"] },
];

export function isExportDataset(value: string): value is ExportDataset {
  return EXPORT_DATASETS.some((dataset) => dataset.value === value);
}

export function isExportFormat(value: string): value is ExportFormat {
  return value === "csv" || value === "xlsx" || value === "pdf";
}

// Qué formatos admite cada dataset, para que la UI no ofrezca una planilla que
// el route handler va a rechazar.
export function exportFormatsFor(dataset: ExportDataset): ExportFormat[] {
  return EXPORT_DATASETS.find((row) => row.value === dataset)?.formats ?? ["csv"];
}

export type ExportResult = {
  body: Buffer | string;
  contentType: string;
  filename: string;
};

export async function buildExport(input: {
  businessId: string;
  dataset: ExportDataset;
  from: Date;
  to: Date;
  format: ExportFormat;
}): Promise<ExportResult> {
  if (input.dataset === "gastos") {
    return buildExpensesExport(input.businessId, input.from, input.to, input.format);
  }

  if (input.dataset === "compras") {
    return buildPurchasesExport(input.businessId, input.from, input.to, input.format);
  }

  if (input.dataset === "inventario") {
    return buildInventoryExport(input.businessId, input.from, input.to, input.format);
  }

  return buildSalesExport(input.businessId, input.from, input.to, input.format);
}

// Existencia final valuada al promedio ponderado de cada sucursal. Es la foto
// del patrimonio en mercadería: lo que la compra dejó en la góndola.
async function buildInventoryExport(businessId: string, from: Date, to: Date, format: ExportFormat): Promise<ExportResult> {
  const products = await prisma.product.findMany({
    where: { businessId, deleted: false, active: true, trackStock: true },
    orderBy: { name: "asc" },
    select: {
      name: true,
      sku: true,
      unit: true,
      cost: true,
      stockLevels: {
        where: { quantity: { not: 0 } },
        select: { quantity: true, avgCost: true, branch: { select: { name: true } } },
      },
    },
  });

  const rows: (string | number | null)[][] = [
    ["Sucursal", "Producto", "SKU", "Existencia", "Costo promedio", "Valuación", "Costo de reposición"],
  ];

  for (const product of products) {
    for (const level of product.stockLevels) {
      const cost = level.avgCost ?? product.cost;

      rows.push([
        level.branch.name,
        product.name,
        product.sku ?? "",
        formatQuantity(level.quantity, product.unit),
        cost ? csvMoney(cost) : "",
        cost ? csvMoney(Math.round((cost * Math.max(level.quantity, 0)) / 1000)) : "",
        product.cost ? csvMoney(product.cost) : "",
      ]);
    }
  }

  return renderExport({ dataset: "inventario", rows, from, to, format });
}

async function buildSalesExport(businessId: string, from: Date, to: Date, format: ExportFormat): Promise<ExportResult> {
  const sales = await findSalesForExport(businessId, from, to);
  const rows = buildSalesRows(sales);

  return renderExport({ dataset: "ventas", rows, from, to, format });
}

async function buildExpensesExport(businessId: string, from: Date, to: Date, format: ExportFormat): Promise<ExportResult> {
  const expenses = await prisma.expense.findMany({
    where: { businessId, deleted: false, spentAt: { gte: from, lte: to } },
    orderBy: { spentAt: "asc" },
    select: {
      spentAt: true,
      category: true,
      paymentMethod: true,
      amount: true,
      note: true,
      branch: { select: { name: true } },
      supplier: { select: { name: true } },
    },
  });

  const rows: (string | number | null)[][] = [
    ["Fecha", "Sucursal", "Rubro", "Proveedor", "Cuenta", "Detalle", "Importe"],
  ];

  for (const expense of expenses) {
    rows.push([
      csvDate(expense.spentAt),
      expense.branch?.name ?? "",
      EXPENSE_CATEGORY_LABELS[expense.category],
      expense.supplier?.name ?? "",
      PAYMENT_METHOD_LABELS[expense.paymentMethod],
      expense.note ?? "",
      csvMoney(expense.amount),
    ]);
  }

  return renderExport({ dataset: "gastos", rows, from, to, format });
}

async function buildPurchasesExport(businessId: string, from: Date, to: Date, format: ExportFormat): Promise<ExportResult> {
  const purchases = await prisma.purchase.findMany({
    where: { businessId, deleted: false, issuedAt: { gte: from, lte: to } },
    orderBy: { issuedAt: "asc" },
    select: {
      issuedAt: true,
      dueAt: true,
      number: true,
      total: true,
      taxAmount: true,
      expenseCategory: true,
      status: true,
      supplier: { select: { name: true, taxId: true } },
      branch: { select: { name: true } },
      payments: { where: { deleted: false }, select: { amount: true } },
      credits: { where: { deleted: false }, select: { amount: true } },
    },
  });

  const rows: (string | number | null)[][] = [
    [
      "Fecha",
      "Vencimiento",
      "Proveedor",
      "CUIT",
      "Sucursal",
      "Comprobante",
      "Concepto",
      "Total",
      "IVA",
      "Notas de crédito",
      "Pagado",
      "Saldo",
      "Estado",
    ],
  ];

  for (const purchase of purchases) {
    const paid = purchase.payments.reduce((sum, payment) => sum + payment.amount, 0);
    const credited = purchase.credits.reduce((sum, credit) => sum + credit.amount, 0);

    rows.push([
      csvDate(purchase.issuedAt),
      purchase.dueAt ? csvDate(purchase.dueAt) : "",
      purchase.supplier.name,
      purchase.supplier.taxId ?? "",
      purchase.branch?.name ?? "",
      purchase.number ?? "",
      purchase.expenseCategory ? EXPENSE_CATEGORY_LABELS[purchase.expenseCategory] : "Mercadería",
      csvMoney(purchase.total),
      purchase.taxAmount ? csvMoney(purchase.taxAmount) : "",
      credited > 0 ? csvMoney(credited) : "",
      csvMoney(paid),
      csvMoney(Math.max(purchase.total - paid - credited, 0)),
      purchase.status,
    ]);
  }

  return renderExport({ dataset: "compras", rows, from, to, format });
}

// El repo de ventas para exportar, separado del armado de filas para que los
// tests de `buildSalesRows` no tengan que tocar la base.
async function findSalesForExport(businessId: string, from: Date, to: Date) {
  return prisma.sale.findMany({
    where: {
      deleted: false,
      soldAt: { gte: from, lte: to },
      branch: { businessId, deleted: false },
    },
    orderBy: { soldAt: "asc" },
    select: {
      id: true,
      soldAt: true,
      subtotal: true,
      discountTotal: true,
      total: true,
      customerName: true,
      customerTaxId: true,
      cae: true,
      branch: { select: { name: true } },
      staff: { select: { name: true } },
      customer: { select: { name: true, taxId: true } },
      items: {
        where: { deleted: false },
        select: {
          description: true,
          quantity: true,
          unit: true,
          unitPrice: true,
          discount: true,
          total: true,
          unitCost: true,
        },
      },
      payments: { where: { deleted: false }, select: { method: true, amount: true } },
    },
  });
}

export type ExportSale = Awaited<ReturnType<typeof findSalesForExport>>[number];

// Una fila por ítem vendido (ver la nota del encabezado del archivo). La
// columna "Medios de pago" vive en la venta y se repite en cada fila del
// comprobante para que ninguna quede sin contexto.
export function buildSalesRows(sales: ExportSale[]): (string | number | null)[][] {
  const rows: (string | number | null)[][] = [
    [
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
      // El costo de lo vendido es lo que le faltaba al contador para armar el
      // resultado: con las compras solas no puede separar lo que se vendió de
      // lo que quedó en la góndola.
      "Costo unitario",
      "Costo del renglón",
      "Medios de pago",
      "Total de la venta",
      "CAE",
    ],
  ];

  for (const sale of sales) {
    const methods = sale.payments
      .map((payment) => `${PAYMENT_METHOD_LABELS[payment.method]} ${payment.amount}`)
      .join(" + ");

    for (const item of sale.items) {
      rows.push([
        csvDateTime(sale.soldAt),
        shortId(sale.id),
        sale.branch.name,
        sale.staff.name,
        sale.customer?.name ?? sale.customerName ?? "Consumidor final",
        sale.customer?.taxId ?? sale.customerTaxId ?? "",
        item.description,
        formatQuantity(item.quantity, item.unit),
        csvMoney(item.unitPrice),
        csvMoney(item.discount),
        csvMoney(item.total),
        item.unitCost ? csvMoney(item.unitCost) : "",
        item.unitCost ? csvMoney(Math.round((item.unitCost * item.quantity) / 1000)) : "",
        methods,
        csvMoney(sale.total),
        sale.cae ?? "",
      ]);
    }
  }

  return rows;
}

// Los ids son cuid: el contador no los va a tipear, pero necesita un
// identificador estable para agrupar las filas de una misma venta.
function shortId(id: string) {
  return id.slice(-6).toUpperCase();
}

function renderExport(input: {
  dataset: ExportDataset;
  rows: (string | number | null)[][];
  from: Date;
  to: Date;
  format: ExportFormat;
}): Promise<ExportResult> {
  const filename = exportFilename(input.dataset, input.from, input.to, input.format);

  if (input.format === "xlsx") {
    return renderXlsx(input.rows).then((body) => ({ body, contentType: XLSX_CONTENT_TYPE, filename }));
  }

  if (input.format === "pdf") {
    return renderPdf(input.dataset, input.rows, input.from, input.to).then((body) => ({
      body,
      contentType: PDF_CONTENT_TYPE,
      filename,
    }));
  }

  return Promise.resolve({ body: toCsv(input.rows), contentType: CSV_CONTENT_TYPE, filename });
}

export function exportFilename(dataset: string, from: Date, to: Date, format: ExportFormat): string {
  return `${dataset}-${isoDay(from)}_a_${isoDay(to)}.${format === "xlsx" ? "xlsx" : format}`;
}

function isoDay(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export const CSV_CONTENT_TYPE = "text/csv; charset=utf-8";
export const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; charset=utf-8";
export const PDF_CONTENT_TYPE = "application/pdf";

async function renderXlsx(rows: (string | number | null)[][]): Promise<Buffer> {
  // Cargado por require y no por import para que TypeScript no lo arrastre al
  // bundle del navegador: esto solo corre en un route handler de Node.
  const ExcelJS = require("exceljs") as typeof import("exceljs");

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Exportación");

  sheet.columns = (rows[0] ?? []).map((header) => ({
    header: String(header),
    width: headerWidth(String(header)),
  }));

  for (const row of rows.slice(1)) {
    sheet.addRow(row.map((cell) => (cell == null ? "" : cell)));
  }

  // Tilde del encabezado y números como números (no texto): el contador quiere
  // poder sumar la columna "Importe" sin pelear con el Excel.
  sheet.getRow(1).font = { bold: true };
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.alignment = { vertical: "middle" };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function headerWidth(header: string): number {
  // El ancho no es exacto (depende de la fuente), pero un piso razonable por
  // carácter evita columnas aplastadas con "Costo del renglón".
  return Math.max(10, Math.min(40, header.length + 2));
}

async function renderPdf(
  dataset: ExportDataset,
  rows: (string | number | null)[][],
  from: Date,
  to: Date,
): Promise<Buffer> {
  // Ídem exceljs: pdfkit es una lib de Node sin versión browser.
  const PDFDocument = require("pdfkit") as typeof import("pdfkit");

  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 32 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  doc.fontSize(14).text(`Bills — Exportación de ${dataset}`, { align: "center" });
  doc.fontSize(10).text(`Período: ${csvDate(from)} al ${csvDate(to)}`, { align: "center" });
  doc.moveDown();

  const headers = rows[0] ?? [];
  const body = rows.slice(1);

  // Tabla simple: columna a columna con la misma grilla que la planilla. Se
  // pagina sola con el salto de página de pdfkit (tabla plana, sin borders).
  const cellPadding = 4;
  const rowHeight = 14;

  doc.fontSize(7);

  for (const [columnIndex, header] of headers.entries()) {
    const x = columnX(columnIndex, headers.length);
    doc.text(String(header), x, doc.y, { width: columnWidth(headers.length) - cellPadding * 2 });
  }

  doc.moveDown(0.4);
  let y = doc.y;

  for (const row of body) {
    if (y > doc.page.height - 70) {
      doc.addPage();
      y = doc.y;
    }

    for (const [columnIndex, cell] of row.entries()) {
      const x = columnX(columnIndex, headers.length);
      doc.text(cell == null ? "" : String(cell), x, y, { width: columnWidth(headers.length) - cellPadding * 2 });
    }

    y += rowHeight;
  }

  doc.end();

  await new Promise<void>((resolve) => doc.on("end", () => resolve()));

  return Buffer.concat(chunks);
}

function columnWidth(columnCount: number): number {
  const pageWidth = 842 - 64; // A4 landscape con margen de 32 por lado.
  return pageWidth / columnCount;
}

function columnX(columnIndex: number, columnCount: number): number {
  return 32 + columnIndex * columnWidth(columnCount);
}
