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

  test("el export de ventas descarga un CSV con encabezados", async ({ page }) => {
    await page.goto("/exportar");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: /Ventas/ }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/^ventas-\d{4}-\d{2}-\d{2}_a_\d{4}-\d{2}-\d{2}\.csv$/);

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const csv = Buffer.concat(chunks).toString("utf8");

    // BOM primero (si no, Excel rompe las tildes) y separador punto y coma.
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("Fecha;Venta;Sucursal;Vendedor;Cliente");
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
