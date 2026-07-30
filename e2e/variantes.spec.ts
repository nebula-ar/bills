import { expect, test } from "@playwright/test";

import { loginAsAdmin, elegirVendedor } from "./helpers";

// Variantes: un modelo con talles se carga de una vez y en el mostrador se ve
// como UNA tarjeta que se abre, no como quince productos sueltos.
test.describe("Variantes", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);

    // Los talles son de la ropa: el seed es un kiosco, así que primero pasamos
    // el negocio a "Local de ropa". Sin eso el botón no existe, y está bien que
    // no exista (ver vertical.test.ts).
    await page.goto("/settings");
    const rubro = page.locator('select[name="vertical"]');

    if ((await rubro.inputValue()) !== "CLOTHING") {
      await rubro.selectOption("CLOTHING");
      await page.locator('input[name="applyPresetModules"]').uncheck();
      await page.getByRole("button", { name: "Guardar rubro" }).click();
      await expect(page.getByText(/Local de ropa/).first()).toBeVisible();
    }
  });

  test("crear un modelo con talles genera un producto por talle", async ({ page }) => {
    await page.goto("/catalog");
    await page.getByRole("button", { name: "Con talles" }).click();

    await page.getByPlaceholder("Ej: Remera lisa").fill("Remera E2E");
    await page.getByRole("button", { name: "Ropa", exact: true }).click();
    await page.getByPlaceholder("$").first().fill("18000");

    // La vista previa dice exactamente qué se va a crear.
    await expect(page.getByText("Se van a crear 4 productos")).toBeVisible();
    await page.getByRole("button", { name: /Crear 4 productos/ }).click();

    await expect(page.getByText("4 variantes creadas.")).toBeVisible({ timeout: 20_000 });

    await page.goto("/catalog");
    await expect(page.getByText("Remera E2E").first()).toBeVisible();
    // Cada talle es su propio producto.
    await expect(page.getByRole("button").filter({ hasText: "Remera E2E" })).toHaveCount(4);
  });

  test("con colores multiplica las combinaciones", async ({ page }) => {
    await page.goto("/catalog");
    await page.getByRole("button", { name: "Con talles" }).click();

    await page.getByPlaceholder("Ej: Remera lisa").fill("Buzo E2E");
    await page.getByPlaceholder("S, M, L, XL").fill("S, M");
    await page.getByPlaceholder("Negro, Blanco").fill("Negro, Blanco, Gris");

    await expect(page.getByText("Se van a crear 6 productos")).toBeVisible();
  });

  test("en el POS el modelo se abre en talles", async ({ page }) => {
    await page.goto("/catalog");
    await page.getByRole("button", { name: "Con talles" }).click();
    await page.getByPlaceholder("Ej: Remera lisa").fill("Campera E2E");
    await page.getByPlaceholder("S, M, L, XL").fill("S, M");
    await page.getByPlaceholder("$").first().fill("50000");
    await page.locator('input[inputmode="numeric"]').nth(2).fill("5");
    await page.getByRole("button", { name: /Crear 2 productos/ }).click();
    await expect(page.getByText("2 variantes creadas.")).toBeVisible({ timeout: 20_000 });

    await page.goto("/sales/new");
    await elegirVendedor(page);
    // Una sola tarjeta para el modelo, con la cantidad de talles.
    const tarjeta = page.getByRole("button").filter({ hasText: "Campera E2E" });
    await expect(tarjeta).toHaveCount(1);
    await expect(tarjeta.getByText("2 talles")).toBeVisible();

    await tarjeta.click();
    await expect(page.getByText("Cada talle tiene su propio stock.")).toBeVisible();
    await page.getByRole("button", { name: /Sumar Campera E2E S/ }).click();
    await page.getByRole("button", { name: "Listo" }).click();

    await expect(page.getByText(/50\.000/).first()).toBeVisible();
  });
});

// La contracara: en un rubro que no maneja talles el botón no está. Es el
// detalle que evita que alguien cargue "Banana talle M".
test("una verdulería no ofrece cargar talles", async ({ page }) => {
  await loginAsAdmin(page);

  await page.goto("/settings");
  await page.locator('select[name="vertical"]').selectOption("GROCERY");
  await page.locator('input[name="applyPresetModules"]').uncheck();
  await page.getByRole("button", { name: "Guardar rubro" }).click();
  await expect(page.getByText(/Verdulería o fiambrería/).first()).toBeVisible();

  await page.goto("/catalog");
  await expect(page.getByRole("button", { name: "Con talles" })).toHaveCount(0);
});
