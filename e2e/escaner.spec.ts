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

  test("en el POS, escanear suma el producto al carrito", async ({ page }) => {
    await page.goto("/sales/new");
    await elegirVendedor(page);
    await page.getByRole("button", { name: "Escanear código" }).click();
    await expect(page.getByRole("heading", { name: "Escanear para vender" })).toBeVisible();

    await page.getByRole("button", { name: "Escribir el código a mano" }).click();
    await page.locator('input[name="code"]').fill("7790001000017");
    await page.getByRole("button", { name: "Buscar" }).click();

    // Confirma la lectura sin cerrar la cámara: se pueden pasar varios seguidos.
    await expect(page.getByTestId("scan-feedback")).toHaveText(/Alfajor triple ×1/, { timeout: 15_000 });

    await page.locator('input[name="code"]').fill("7790001000017");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page.getByTestId("scan-feedback")).toHaveText(/Alfajor triple ×2/, { timeout: 15_000 });

    // Al cerrar, el carrito quedó cargado: 2 alfajores a $1.800 = $3.600 (con
    // dos unidades el 3x2 todavía no se dispara).
    await page.getByRole("button", { name: "Cerrar" }).click();
    await expect(page.getByText(/3\.600/).first()).toBeVisible({ timeout: 15_000 });
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
