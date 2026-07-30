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

  test("crear un vendedor con PIN", async ({ page }) => {
    await page.goto("/staff");
    await page.getByRole("button", { name: "Nuevo vendedor" }).click();
    await page.locator('input[name="name"]').fill("Vendedor E2E");
    await page.locator('input[name="pin"]').fill("9876");
    await page.getByRole("button", { name: "Crear vendedor" }).click();
    await expect(page.getByText("Vendedor E2E").first()).toBeVisible();
  });

  test("crear un producto con precio", async ({ page }) => {
    await page.goto("/catalog");
    await page.getByRole("button", { name: "Nuevo producto" }).click();
    await page.locator('input[name="name"]').fill("Producto E2E");
    await page.locator('input[name="price"]').fill("5000");
    await page.getByRole("button", { name: "Crear producto" }).click();
    await expect(page.getByText("Producto E2E").first()).toBeVisible();
  });
});
