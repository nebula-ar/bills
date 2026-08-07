import { expect, test } from "@playwright/test";

import { loginAsAdmin, elegirVendedor } from "./helpers";

// Tres cosas que el mostrador pide todo el tiempo: cargar un bulto de una,
// mandarle la planilla al contador y avisar por WhatsApp.
test.describe("Bulto, export y WhatsApp", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("el botón de bulto carga la caja entera", async ({ page }) => {
    await page.goto("/sales/new");
    await elegirVendedor(page);

    // La gaseosa viene en cajas de 12 (ver seed).
    const tarjeta = page.locator("div").filter({ hasText: /^Gaseosa 500 ml/ }).first();
    await page.getByRole("button", { name: "Agregar Caja de Gaseosa 500 ml" }).click();

    await expect(tarjeta.getByText("12", { exact: true })).toBeVisible();

    // Y el total del pedido es el de 12 unidades, no el de una.
    await page.getByRole("button", { name: /Cobrar/ }).click();
    await expect(page.getByText("$ 26.400").first()).toBeVisible();
  });

  test("el export de ventas descarga CSV, Excel y PDF", async ({ page }) => {
    await page.goto("/exportar");

    // Cada link de descarga lleva dataset y formato en el href; los cuatro
    // datasets tienen un "CSV", así que se desambigua por el href de ventas.
    const ventasCsv = page.locator('a[href*="dataset=ventas"][href*="format=csv"]');
    const ventasXlsx = page.locator('a[href*="dataset=ventas"][href*="format=xlsx"]');
    const ventasPdf = page.locator('a[href*="dataset=ventas"][href*="format=pdf"]');

    // CSV: BOM primero (si no, Excel rompe las tildes) y separador punto y coma.
    const [csvDownload] = await Promise.all([
      page.waitForEvent("download"),
      ventasCsv.click(),
    ]);

    expect(csvDownload.suggestedFilename()).toMatch(/^ventas-\d{4}-\d{2}-\d{2}_a_\d{4}-\d{2}-\d{2}\.csv$/);

    const stream = await csvDownload.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const csv = Buffer.concat(chunks).toString("utf8");

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("Fecha;Venta;Sucursal;Vendedor;Cliente");

    // Excel: un .xlsx de verdad (zip con la firma PK).
    const [xlsxDownload] = await Promise.all([
      page.waitForEvent("download"),
      ventasXlsx.click(),
    ]);

    expect(xlsxDownload.suggestedFilename()).toMatch(/\.xlsx$/);

    const xlsxStream = await xlsxDownload.createReadStream();
    const xlsxChunks: Buffer[] = [];
    for await (const chunk of xlsxStream) xlsxChunks.push(chunk as Buffer);
    const xlsx = Buffer.concat(xlsxChunks);

    expect(xlsx.subarray(0, 2).toString("utf8")).toBe("PK");

    // Los importes del xlsx van como NÚMEROS (sumables), no como texto: en el
    // XML de la hoja una celda numérica no lleva t="s" ni t="str". Se desarma
    // el zip y se lee el XML de la primera hoja.
    const sheetXml = await readXlsxSheetXml(xlsx);
    const importeCells = sheetXml.match(/<c r="K[2-9]\d*"[^>]*>/g) ?? [];
    expect(importeCells.length).toBeGreaterThan(0);
    for (const cell of importeCells) {
      expect(cell).not.toContain('t="s"');
      expect(cell).not.toContain('t="str"');
    }

    // La columna Fecha (A) va como fecha nativa (serial de Excel), no texto.
    // El regex arranca en la fila 2 para saltear el header (que sí es string).
    const fechaCells = sheetXml.match(/<c r="A[2-9]\d*"[^>]*>/g) ?? [];
    expect(fechaCells.length).toBeGreaterThan(0);
    for (const cell of fechaCells) {
      expect(cell).not.toContain('t="s"');
      expect(cell).not.toContain('t="str"');
    }

    // PDF: empieza con la firma %PDF.
    const [pdfDownload] = await Promise.all([
      page.waitForEvent("download"),
      ventasPdf.click(),
    ]);

    expect(pdfDownload.suggestedFilename()).toMatch(/\.pdf$/);

    const pdfStream = await pdfDownload.createReadStream();
    const pdfChunks: Buffer[] = [];
    for await (const chunk of pdfStream) pdfChunks.push(chunk as Buffer);
    const pdf = Buffer.concat(pdfChunks);

    expect(pdf.subarray(0, 5).toString("utf8")).toBe("%PDF-");
  });

  test("un rango invertido no deja descargar", async ({ page }) => {
    await page.goto("/exportar");

    await page.getByLabel("Desde").fill("2026-07-31");
    await page.getByLabel("Hasta").fill("2026-07-01");

    await expect(page.getByText("Revisá el rango: el desde tiene que ser anterior.")).toBeVisible();
  });

  test("el recordatorio de deuda arma el link de WhatsApp con el saldo", async ({ page }) => {
    await page.goto("/customers");

    // Rodrigo Pérez debe $12.500 en el seed.
    await page.getByRole("link", { name: "Rodrigo Pérez" }).click();

    const link = page.getByRole("link", { name: "Recordar deuda" });
    await expect(link).toBeVisible();

    const href = decodeURIComponent((await link.getAttribute("href")) ?? "");
    // Número normalizado (sin 0 ni 15) y el saldo dentro del mensaje.
    expect(href).toMatch(/^https:\/\/wa\.me\/549\d+\?text=/);
    expect(href).toContain("saldo pendiente");
  });

  test("el comprobante de una venta se puede mandar por WhatsApp", async ({ page }) => {
    await page.goto("/sales");

    await page.getByRole("button").filter({ hasText: /\$/ }).first().click();

    const link = page.getByRole("link", { name: "Mandar comprobante" });
    await expect(link).toBeVisible();

    const href = decodeURIComponent((await link.getAttribute("href")) ?? "");
    expect(href).toContain("Kiosco El Rulo");
    expect(href).toContain("Total:");
  });
});

// Extrae el XML de la primera hoja de un .xlsx. Un xlsx es un zip; la hoja vive
// en `xl/worksheets/sheet1.xml`. Se parsea con el parser ZIP mínimo de Node
// (sin dependencias) porque el e2e corre en el navegador de Playwright.
async function readXlsxSheetXml(xlsx: Buffer): Promise<string> {
  const { inflateRawSync } = await import("node:zlib");

  // Recorre el directorio central del zip (EOCD + entries) buscando el nombre.
  let offset = 0;
  const entries = new Map<string, { offset: number; size: number }>();

  // Central directory: firma 0x02014b50.
  for (let i = 0; i < xlsx.length - 4; i++) {
    if (xlsx.readUInt32LE(i) !== 0x02014b50) continue;

    const fileNameLength = xlsx.readUInt16LE(i + 28);
    const extraLength = xlsx.readUInt16LE(i + 30);
    const commentLength = xlsx.readUInt16LE(i + 32);
    const localHeaderOffset = xlsx.readUInt32LE(i + 42);
    const compressedSize = xlsx.readUInt32LE(i + 20);
    const name = xlsx.slice(i + 46, i + 46 + fileNameLength).toString("utf8");

    entries.set(name, { offset: localHeaderOffset, size: compressedSize });
  }

  const entry = entries.get("xl/worksheets/sheet1.xml");
  if (!entry) throw new Error("No se encontró xl/worksheets/sheet1.xml en el xlsx");

  // Local file header: la data arranca después del header (30 bytes) + nombres.
  const localHeader = entry.offset;
  const nameLength = xlsx.readUInt16LE(localHeader + 26);
  const extraLength = xlsx.readUInt16LE(localHeader + 28);
  const dataStart = localHeader + 30 + nameLength + extraLength;

  const compressed = xlsx.slice(dataStart, dataStart + entry.size);
  return inflateRawSync(compressed).toString("utf8");
}
