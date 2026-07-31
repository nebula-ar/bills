import { expect, test } from "@playwright/test";

import { loginAsAdmin, elegirVendedor } from "./helpers";

// El escáner de códigos. La lectura por cámara no se puede simular headless con
// un código real, así que se ejercita por la entrada manual — que además es una
// función de verdad: sin HTTPS (o con el código roto) es la única forma de cargar.
test.describe("Escáner de códigos", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("un código nuevo abre el alta guiada y crea el producto", async ({ page }) => {
    const code = `779${Date.now()}`.slice(0, 13);

    await page.goto("/catalog");
    await page.getByRole("button", { name: "Escanear" }).click();
    await expect(page.getByRole("heading", { name: "Cargar producto" })).toBeVisible();

    await page.getByRole("button", { name: "Escribir el código a mano" }).click();
    await page.locator('input[name="code"]').fill(code);
    await page.getByRole("button", { name: "Buscar" }).click();

    // Alta guiada: nombre y precio son los únicos obligatorios.
    await expect(page.getByText("¿Qué producto es?")).toBeVisible({ timeout: 15_000 });
    await page.getByPlaceholder("Ej: Alfajor triple").fill("Escaneado E2E");
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(page.getByText("¿A cuánto lo vendés?")).toBeVisible();
    await page.locator('input[inputmode="numeric"]').fill("2500");
    await page.getByRole("button", { name: "Continuar" }).click();

    // Desde el costo en adelante ya se puede guardar.
    await expect(page.getByText("¿Cuánto te costó?")).toBeVisible();
    await page.getByRole("button", { name: "Listo" }).click();

    await expect(page.getByText("Escaneado E2E agregado al catálogo.")).toBeVisible({ timeout: 20_000 });

    // Quedó cargado y con precio, así que se puede vender.
    await page.goto("/catalog");
    await expect(page.getByRole("button").filter({ hasText: "Escaneado E2E" }).first()).toBeVisible();
  });

  test("un código ya cargado avisa en vez de duplicarlo", async ({ page }) => {
    await page.goto("/catalog");
    await page.getByRole("button", { name: "Escanear" }).click();
    await page.getByRole("button", { name: "Escribir el código a mano" }).click();
    // Código del alfajor, sembrado por prisma/seed.ts.
    await page.locator('input[name="code"]').fill("7790001000017");
    await page.getByRole("button", { name: "Buscar" }).click();

    await expect(page.getByTestId("scan-feedback")).toHaveText(/Ya lo tenés/, { timeout: 15_000 });
  });

  test("en el POS, escanear pide confirmar el producto y la cantidad", async ({ page }) => {
    await page.goto("/sales/new");
    await elegirVendedor(page);
    await page.getByRole("button", { name: "Escanear código" }).click();
    await expect(page.getByRole("heading", { name: "Escanear para vender" })).toBeVisible();

    await page.getByRole("button", { name: "Escribir el código a mano" }).click();
    await page.locator('input[name="code"]').fill("7790001000017");
    await page.getByRole("button", { name: "Buscar" }).click();

    // No entra solo al pedido: primero se ve QUÉ es y CUÁNTOS.
    await expect(page.getByText("¿Cuántos?")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("paragraph").filter({ hasText: "Alfajor triple" })).toBeVisible();
    await expect(page.getByTestId("scan-confirm")).toContainText("1.800");

    // Dos unidades: el total del botón acompaña.
    await page.getByRole("button", { name: "Sumar" }).click();
    await expect(page.getByTestId("scan-confirm")).toContainText("3.600");

    await page.getByTestId("scan-confirm").click();
    await expect(page.getByTestId("scan-feedback")).toHaveText(/Alfajor triple/, { timeout: 15_000 });

    // Y el carrito quedó con lo confirmado: 2 alfajores = $3.600.
    await page.getByRole("button", { name: "Cerrar" }).click();
    await expect(page.getByText(/3\.600/).first()).toBeVisible({ timeout: 15_000 });
  });

  test("se puede cancelar lo escaneado sin que entre al pedido", async ({ page }) => {
    await page.goto("/sales/new");
    await elegirVendedor(page);
    await page.getByRole("button", { name: "Escanear código" }).click();
    await page.getByRole("button", { name: "Escribir el código a mano" }).click();
    await page.locator('input[name="code"]').fill("7790001000017");
    await page.getByRole("button", { name: "Buscar" }).click();

    await expect(page.getByText("¿Cuántos?")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("scan-cancel").click();

    // Nada se agregó: el pedido sigue vacío.
    await expect(page.getByText("¿Cuántos?")).toHaveCount(0);
    await page.getByRole("button", { name: "Cerrar" }).click();
    await expect(page.getByRole("button", { name: /Confirmar venta/ })).toHaveCount(0);
  });

  test("el atajo de bulto carga la caja entera de una", async ({ page }) => {
    await page.goto("/sales/new");
    await elegirVendedor(page);
    await page.getByRole("button", { name: "Escanear código" }).click();
    await page.getByRole("button", { name: "Escribir el código a mano" }).click();
    // Gaseosa: viene en cajas de 12 (ver seed).
    await page.locator('input[name="code"]').fill("7790002000014");
    await page.getByRole("button", { name: "Buscar" }).click();

    await expect(page.getByText("¿Cuántos?")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /Caja ×12/ }).click();
    // 12 × $2.200 = $26.400
    await expect(page.getByTestId("scan-confirm")).toContainText("26.400");
  });

  test("un código desconocido en el POS avisa que no está", async ({ page }) => {
    await page.goto("/sales/new");
    await elegirVendedor(page);
    await page.getByRole("button", { name: "Escanear código" }).click();
    await page.getByRole("button", { name: "Escribir el código a mano" }).click();
    await page.locator('input[name="code"]').fill("0000000000000");
    await page.getByRole("button", { name: "Buscar" }).click();

    await expect(page.getByTestId("scan-feedback")).toHaveText(/no está en el catálogo/, { timeout: 15_000 });
  });
});
