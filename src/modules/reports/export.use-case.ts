import { EXPENSE_CATEGORY_LABELS } from "@/lib/expense-labels";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-labels";
import { prisma } from "@/lib/prisma";
import { formatQuantity } from "@/lib/quantity";
import type { Unit } from "@/generated/prisma/enums";

import { csvDate, csvDateTime, csvMoney, toCsv } from "./csv.logic";

// Exportar para el contador.
//
// Una fila por ítem y no por venta: el contador necesita ver qué se vendió, y
// una venta con cinco renglones colapsada en una línea no le sirve para nada.
// El número de venta se repite en cada fila para que pueda agrupar en la
// planilla.
//
// Cada dataset declara sus columnas con un "kind" (text, money, quantity,
// datetime o date) y los builders producen valores CRUDOS: el importe es un
// número entero en pesos, la cantidad milésimas, la fecha un Date. Recién al
// renderizar cada formato convierte a lo que ese formato necesita:
//   - CSV:  separador `;`, importes con coma decimal, fechas dd/mm/aaaa.
//   - XLSX: números como números (sumables) con numFmt es-AR de display.
//   - PDF:  texto formateado, tabla legible.
// Así el Excel no repite el texto del CSV y el PDF puede decidir su layout
// sin pelear con strings preformateados.

export type ExportDataset = "ventas" | "gastos" | "compras" | "inventario";
export type ExportFormat = "csv" | "xlsx" | "pdf";

export type ExportColumnKind = "text" | "money" | "quantity" | "datetime" | "date";

export type ExportColumn = {
  header: string;
  kind: ExportColumnKind;
};

// Una cantidad cruda: milésimas + su unidad. La unidad la decide cada fila
// (un ítem se vende por kg, otro por unidad), así que viaja con el valor.
export type ExportQuantity = {
  value: number;
  unit: Unit;
};

// Un valor crudo de celda. `Date` para fechas (lo arma el builder con lo que
// viene de la DB), `number` para importes, `ExportQuantity` para cantidades,
// `string` para texto.
export type ExportCellValue = string | number | ExportQuantity | Date | null;

export type ExportTable = {
  columns: ExportColumn[];
  rows: ExportCellValue[][];
};

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

  const table: ExportTable = {
    columns: [
      { header: "Sucursal", kind: "text" },
      { header: "Producto", kind: "text" },
      { header: "SKU", kind: "text" },
      { header: "Existencia", kind: "quantity" },
      { header: "Costo promedio", kind: "money" },
      { header: "Valuación", kind: "money" },
      { header: "Costo de reposición", kind: "money" },
    ],
    rows: [],
  };

  for (const product of products) {
    for (const level of product.stockLevels) {
      const cost = level.avgCost ?? product.cost;

      table.rows.push([
        level.branch.name,
        product.name,
        product.sku ?? "",
        { value: level.quantity, unit: product.unit },
        cost ?? null,
        cost ? Math.round((cost * Math.max(level.quantity, 0)) / 1000) : null,
        product.cost ?? null,
      ]);
    }
  }

  return renderExport({ dataset: "inventario", table, from, to, format });
}

async function buildSalesExport(businessId: string, from: Date, to: Date, format: ExportFormat): Promise<ExportResult> {
  const sales = await findSalesForExport(businessId, from, to);
  const table = buildSalesTable(sales);

  return renderExport({ dataset: "ventas", table, from, to, format });
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

  const table: ExportTable = {
    columns: [
      { header: "Fecha", kind: "date" },
      { header: "Sucursal", kind: "text" },
      { header: "Rubro", kind: "text" },
      { header: "Proveedor", kind: "text" },
      { header: "Cuenta", kind: "text" },
      { header: "Detalle", kind: "text" },
      { header: "Importe", kind: "money" },
    ],
    rows: [],
  };

  for (const expense of expenses) {
    table.rows.push([
      expense.spentAt,
      expense.branch?.name ?? "",
      EXPENSE_CATEGORY_LABELS[expense.category],
      expense.supplier?.name ?? "",
      PAYMENT_METHOD_LABELS[expense.paymentMethod],
      expense.note ?? "",
      expense.amount,
    ]);
  }

  return renderExport({ dataset: "gastos", table, from, to, format });
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

  const table: ExportTable = {
    columns: [
      { header: "Fecha", kind: "date" },
      { header: "Vencimiento", kind: "date" },
      { header: "Proveedor", kind: "text" },
      { header: "CUIT", kind: "text" },
      { header: "Sucursal", kind: "text" },
      { header: "Comprobante", kind: "text" },
      { header: "Concepto", kind: "text" },
      { header: "Total", kind: "money" },
      { header: "IVA", kind: "money" },
      { header: "Notas de crédito", kind: "money" },
      { header: "Pagado", kind: "money" },
      { header: "Saldo", kind: "money" },
      { header: "Estado", kind: "text" },
    ],
    rows: [],
  };

  for (const purchase of purchases) {
    const paid = purchase.payments.reduce((sum, payment) => sum + payment.amount, 0);
    const credited = purchase.credits.reduce((sum, credit) => sum + credit.amount, 0);

    table.rows.push([
      purchase.issuedAt,
      purchase.dueAt ?? null,
      purchase.supplier.name,
      purchase.supplier.taxId ?? "",
      purchase.branch?.name ?? "",
      purchase.number ?? "",
      purchase.expenseCategory ? EXPENSE_CATEGORY_LABELS[purchase.expenseCategory] : "Mercadería",
      purchase.total,
      purchase.taxAmount ?? null,
      credited > 0 ? credited : null,
      paid,
      Math.max(purchase.total - paid - credited, 0),
      purchase.status,
    ]);
  }

  return renderExport({ dataset: "compras", table, from, to, format });
}

// El repo de ventas para exportar, separado del armado de la tabla para que los
// tests de `buildSalesTable` no tengan que tocar la base.
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

export const SALES_EXPORT_COLUMNS: ExportColumn[] = [
  { header: "Fecha", kind: "datetime" },
  { header: "Venta", kind: "text" },
  { header: "Sucursal", kind: "text" },
  { header: "Vendedor", kind: "text" },
  { header: "Cliente", kind: "text" },
  { header: "CUIT/DNI", kind: "text" },
  { header: "Producto", kind: "text" },
  { header: "Cantidad", kind: "quantity" },
  { header: "Precio unitario", kind: "money" },
  { header: "Descuento", kind: "money" },
  { header: "Importe", kind: "money" },
  // El costo de lo vendido es lo que le faltaba al contador para armar el
  // resultado: con las compras solas no puede separar lo que se vendió de
  // lo que quedó en la góndola.
  { header: "Costo unitario", kind: "money" },
  { header: "Costo del renglón", kind: "money" },
  { header: "Medios de pago", kind: "text" },
  { header: "Total de la venta", kind: "money" },
  { header: "CAE", kind: "text" },
];

// Una fila por ítem vendido (ver la nota del encabezado del archivo). La
// columna "Medios de pago" vive en la venta y se repite en cada fila del
// comprobante para que ninguna quede sin contexto.
export function buildSalesTable(sales: ExportSale[]): ExportTable {
  const rows: ExportCellValue[][] = [];

  for (const sale of sales) {
    const methods = sale.payments
      .map((payment) => `${PAYMENT_METHOD_LABELS[payment.method]} ${payment.amount}`)
      .join(" + ");

    for (const item of sale.items) {
      rows.push([
        sale.soldAt,
        shortId(sale.id),
        sale.branch.name,
        sale.staff.name,
        sale.customer?.name ?? sale.customerName ?? "Consumidor final",
        sale.customer?.taxId ?? sale.customerTaxId ?? "",
        item.description,
        { value: item.quantity, unit: item.unit },
        item.unitPrice,
        item.discount,
        item.total,
        item.unitCost ?? null,
        item.unitCost ? Math.round((item.unitCost * item.quantity) / 1000) : null,
        methods,
        sale.total,
        sale.cae ?? "",
      ]);
    }
  }

  return { columns: SALES_EXPORT_COLUMNS, rows };
}

// Los ids son cuid: el contador no los va a tipear, pero necesita un
// identificador estable para agrupar las filas de una misma venta.
function shortId(id: string) {
  return id.slice(-6).toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// Renderizado por formato

function renderExport(input: {
  dataset: ExportDataset;
  table: ExportTable;
  from: Date;
  to: Date;
  format: ExportFormat;
}): Promise<ExportResult> {
  const filename = exportFilename(input.dataset, input.from, input.to, input.format);

  if (input.format === "xlsx") {
    return renderXlsx(input.table).then((body) => ({ body, contentType: XLSX_CONTENT_TYPE, filename }));
  }

  if (input.format === "pdf") {
    return renderPdf(input.dataset, input.table, input.from, input.to).then((body) => ({
      body,
      contentType: PDF_CONTENT_TYPE,
      filename,
    }));
  }

  return Promise.resolve({ body: toCsv(tableToCsvRows(input.table)), contentType: CSV_CONTENT_TYPE, filename });
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

// Convierte una celda cruda al texto que espera la planilla (CSV y PDF): los
// importes con coma decimal y las cantidades con la unidad abreviada.
export function formatExportCell(column: ExportColumn, value: ExportCellValue): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (column.kind === "money") {
    return csvMoney(value as number);
  }

  if (column.kind === "quantity") {
    return formatQuantity((value as ExportQuantity).value, (value as ExportQuantity).unit);
  }

  if (column.kind === "datetime") {
    return csvDateTime(value as Date);
  }

  if (column.kind === "date") {
    return csvDate(value as Date);
  }

  return String(value);
}

function tableToCsvRows(table: ExportTable): (string | number | null)[][] {
  const rows: (string | number | null)[][] = [table.columns.map((column) => column.header)];

  for (const row of table.rows) {
    rows.push(table.columns.map((column, index) => formatExportCell(column, row[index])));
  }

  return rows;
}

export async function renderXlsx(table: ExportTable): Promise<Buffer> {
  // Cargado por require y no por import para que TypeScript no lo arrastre al
  // bundle del navegador: esto solo corre en un route handler de Node.
  const ExcelJS = require("exceljs") as typeof import("exceljs");

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Exportación");

  sheet.columns = table.columns.map((column) => ({
    header: column.header,
    width: headerWidth(column.header),
  }));

  // Los importes van como NÚMEROS para que el contador los pueda sumar; el
  // display es-AR lo pone el numFmt. Las cantidades son números (milésimas).
  for (const row of table.rows) {
    sheet.addRow(
      table.columns.map((column, index) => {
        const value = row[index];

        if (value === null || value === undefined) {
          return "";
        }

        if (column.kind === "money") {
          return value as number;
        }

        if (column.kind === "quantity") {
          return (value as ExportQuantity).value;
        }

        return formatExportCell(column, value);
      }),
    );
  }

  // Columna de moneda: número con formato es-AR de display.
  table.columns.forEach((column, index) => {
    if (column.kind === "money") {
      sheet.getColumn(index + 1).numFmt = "#,##0.00";
    }
  });

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

// Una columna del PDF con su índice original en la fila de la tabla: el subset
// de ventas no es un prefijo de las 16 columnas, y las celdas se leen de la
// fila completa.
export type PdfColumn = {
  column: ExportColumn;
  sourceIndex: number;
};

// Las columnas que el contador necesita en papel. Con las 16 columnas de la
// planilla, cada celda mide ~40pt y el texto se apila o se corta ilegible; en
// el PDF se muestran las que importan para un resumen impreso. La planilla
// (CSV/Excel) conserva las 16.
export const SALES_PDF_COLUMNS: PdfColumn[] = [
  { column: { header: "Fecha", kind: "datetime" }, sourceIndex: 0 },
  { column: { header: "Venta", kind: "text" }, sourceIndex: 1 },
  { column: { header: "Sucursal", kind: "text" }, sourceIndex: 2 },
  { column: { header: "Vendedor", kind: "text" }, sourceIndex: 3 },
  { column: { header: "Producto", kind: "text" }, sourceIndex: 6 },
  { column: { header: "Cantidad", kind: "quantity" }, sourceIndex: 7 },
  { column: { header: "Importe", kind: "money" }, sourceIndex: 10 },
  { column: { header: "Medios de pago", kind: "text" }, sourceIndex: 13 },
  { column: { header: "Total de la venta", kind: "money" }, sourceIndex: 14 },
];

// El subset de columnas que se imprime por dataset: ventas usa el resumen,
// el resto (que no tiene PDF) cae en todas en orden.
export function pdfColumnsFor(dataset: ExportDataset, table: ExportTable): PdfColumn[] {
  if (dataset === "ventas") {
    return SALES_PDF_COLUMNS;
  }

  return table.columns.map((column, index) => ({ column, sourceIndex: index }));
}

// Un PDF apaisado con los textos en una línea por celda. El header se dibuja
// con un `y` FIJO (no `doc.y`, que avanza con cada text()) y las filas miden
// lo que su celda más alta (heightOfString + padding), con salto de página
// cuando no entra.
export async function renderPdf(dataset: ExportDataset, table: ExportTable, from: Date, to: Date): Promise<Buffer> {
  // Ídem exceljs: pdfkit es una lib de Node sin versión browser.
  const PDFDocument = require("pdfkit") as typeof import("pdfkit");

  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 32 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  const pdfColumns = pdfColumnsFor(dataset, table);
  const layout = computePdfLayout(pdfColumns.length);

  doc.fontSize(14).text(`Bills — Exportación de ${dataset}`, { align: "center" });
  doc.fontSize(10).text(`Período: ${csvDate(from)} al ${csvDate(to)}`, { align: "center" });
  doc.moveDown();

  // Header en UNA línea: mismo `y` para todas las columnas.
  const headerY = doc.y;
  doc.fontSize(layout.fontSize);

  for (const [columnIndex, pdfColumn] of pdfColumns.entries()) {
    doc.text(pdfColumn.column.header, layout.x(columnIndex), headerY, {
      width: layout.columnWidth - layout.cellPadding * 2,
    });
  }

  const headerBottom = headerY + layout.fontSize * 1.4 + layout.cellPadding * 2;

  let y = headerBottom;

  for (const row of table.rows) {
    const rowHeight = computePdfRowHeight(doc, layout, pdfColumns, row);

    if (y + rowHeight > doc.page.height - 56) {
      doc.addPage();
      y = doc.y;
    }

    for (const [columnIndex, pdfColumn] of pdfColumns.entries()) {
      const cellText = formatExportCell(pdfColumn.column, row[pdfColumn.sourceIndex]);
      doc.text(cellText, layout.x(columnIndex), y, {
        width: layout.columnWidth - layout.cellPadding * 2,
        lineBreak: false,
      });
    }

    y += rowHeight;
  }

  doc.end();

  await new Promise<void>((resolve) => doc.on("end", () => resolve()));

  return Buffer.concat(chunks);
}

// Cómo se dibuja el PDF, calculado una vez. A más columnas, fuente más chica:
// 9 columnas (ventas en papel) -> 7pt; 7 columnas -> 9pt. Se exporta para
// poder testear la altura de fila sin pdfkit.
export function computePdfLayout(columnCount: number): {
  fontSize: number;
  cellPadding: number;
  columnWidth: number;
  x: (columnIndex: number) => number;
} {
  const margin = 32;
  const pageWidth = 842; // A4 landscape.
  const columnWidth = (pageWidth - margin * 2) / columnCount;
  const cellPadding = 3;

  const fontSize = Math.max(6, Math.min(10, Math.floor(64 / columnCount)));

  return {
    fontSize,
    cellPadding,
    columnWidth,
    x: (columnIndex) => margin + columnIndex * columnWidth,
  };
}

// Altura mínima de una fila: la del texto más alto de esa fila. Cada celda
// mide lo que `heightOfString` diga con el ancho disponible; con `lineBreak:
// false` los textos largos se cortan en vez de superponerse.
export function computePdfRowHeight(
  doc: { heightOfString: (text: string, options: { width: number }) => number },
  layout: { fontSize: number; cellPadding: number; columnWidth: number },
  columns: PdfColumn[],
  row: ExportCellValue[],
): number {
  const width = layout.columnWidth - layout.cellPadding * 2;
  const maxCellHeight = columns.reduce((max, pdfColumn) => {
    const text = formatExportCell(pdfColumn.column, row[pdfColumn.sourceIndex]);
    const height = doc.heightOfString(text, { width });
    return Math.max(max, height);
  }, 0);

  return Math.max(maxCellHeight, layout.fontSize * 1.6) + layout.cellPadding * 2;
}
