import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./helpers";

test.describe("ABM (alta de entidades)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("crear una sucursal", async ({ page }) => {
    await page.goto("/branches");
    await page.getByRole("button", { name: "Nueva sucursal" }).click();
    await page.locator('input[name="name"]').fill("Sucursal E2E");
    await page.getByRole("button", { name: "Crear sucursal" }).click();
    await expect(page.getByText("Sucursal E2E").first()).toBeVisible();
  });

  test("crear un barbero con PIN", async ({ page }) => {
    await page.goto("/barbers");
    await page.getByRole("button", { name: "Nuevo barbero" }).click();
    await page.locator('input[name="name"]').fill("Barbero E2E");
    await page.locator('input[name="pin"]').fill("9876");
    await page.getByRole("button", { name: "Crear barbero" }).click();
    await expect(page.getByText("Barbero E2E").first()).toBeVisible();
  });

  test("crear un servicio con precio", async ({ page }) => {
    await page.goto("/services");
    await page.getByRole("button", { name: "Nuevo servicio" }).click();
    await page.locator('input[name="name"]').fill("Servicio E2E");
    await page.locator('input[name="price"]').fill("5000");
    await page.getByRole("button", { name: "Crear servicio" }).click();
    await expect(page.getByText("Servicio E2E").first()).toBeVisible();
  });
});
