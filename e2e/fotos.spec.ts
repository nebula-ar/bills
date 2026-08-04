import { expect, test } from "@playwright/test";

import { loginAsAdmin, elegirVendedor } from "./helpers";

// La foto del producto: se carga desde el catálogo y tiene que verse al vender,
// que es para lo que sirve (elegir por imagen es más rápido que leer una lista).
test.describe("Fotos de productos", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("ofrece generar una foto desde descripción sin obligar a usar la cámara", async ({ page }) => {
    await page.goto("/catalog");
    await page.getByRole("button", { name: /Chocolate/ }).first().click();

    await page.getByRole("button", { name: "Agregar foto al producto" }).click();
    await expect(page.getByRole("heading", { name: "Creá la imagen del producto" })).toBeVisible();
    await page.getByRole("button", { name: /Generar desde descripción/ }).click();
    await expect(page.getByRole("heading", { name: "Generar foto con IA" })).toBeVisible();

    await page.locator("textarea").fill("Chocolate artesanal sobre fondo limpio");
    await expect(page.getByRole("button", { name: "Generar imagen" })).toBeEnabled();
    await page.getByRole("button", { name: "Cerrar" }).click();
    await expect(page.getByRole("heading", { name: "Generar foto con IA" })).toHaveCount(0);
  });

  test("permite agregar la foto al crear un producto sin salir del modal", async ({ page }) => {
    await page.goto("/catalog");
    await page.getByRole("button", { name: "Nuevo producto" }).click();

    await page.getByRole("textbox", { name: "Nombre" }).fill("Producto con foto nueva");
    await page.getByRole("button", { name: "Crear y agregar foto" }).click();

    await expect(page.getByRole("heading", { name: "Foto de Producto con foto nueva" })).toBeVisible();
    await expect(page.getByText("Sacá, elegí o generá una foto")).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles("e2e/fixtures/producto.jpg");
    await expect(page.getByText("Guardada", { exact: true })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Listo" }).click();

    const fila = page.getByRole("button").filter({ hasText: "Producto con foto nueva" });
    await expect(fila.locator('img[src*="/api/products/"]')).toBeVisible();
  });

  test("subir una foto la deja visible en el catálogo y en el POS", async ({ page }) => {
    await page.goto("/catalog");
    await page.getByRole("button", { name: /Chocolate/ }).first().click();

    await page.locator('input[type="file"]').setInputFiles("e2e/fixtures/producto.jpg");
    await expect(page.getByText("Guardada", { exact: true })).toBeVisible({ timeout: 30_000 });

    // Persistió: al recargar el listado, la fila muestra la miniatura.
    await page.goto("/catalog");
    const fila = page.getByRole("button").filter({ hasText: "Chocolate" }).first();
    await expect(fila.locator('img[src*="/api/products/"]')).toBeVisible();

    // Y aparece en la pantalla de venta.
    await page.goto("/sales/new");
    await elegirVendedor(page);
    await expect(page.locator('img[src*="/api/products/"]').first()).toBeVisible({ timeout: 15_000 });
  });

  test("la foto se puede quitar", async ({ page }) => {
    await page.goto("/catalog");
    await page.getByRole("button", { name: /Chocolate/ }).first().click();
    await page.locator('input[type="file"]').setInputFiles("e2e/fixtures/producto.jpg");
    await expect(page.getByText("Guardada", { exact: true })).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "Quitar" }).click();
    await expect(page.getByText("Sacá o elegí una foto")).toBeVisible({ timeout: 15_000 });
  });

  test("la foto de un producto no se sirve sin sesión", async ({ page, request }) => {
    await page.goto("/catalog");
    await page.getByRole("button", { name: /Chocolate/ }).first().click();
    await page.locator('input[type="file"]').setInputFiles("e2e/fixtures/producto.jpg");
    await expect(page.getByText("Guardada", { exact: true })).toBeVisible({ timeout: 30_000 });

    const src = await page.locator('img[src*="/api/products/"]').first().getAttribute("src");
    expect(src).toBeTruthy();

    // `request` es un contexto aparte, sin las cookies del navegador.
    const anonima = await request.get(src!);
    expect(anonima.status()).toBe(401);
  });
});
