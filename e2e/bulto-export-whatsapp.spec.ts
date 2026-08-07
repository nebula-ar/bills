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
