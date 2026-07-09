import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./helpers";

async function crearVenta(page: import("@playwright/test").Page) {
  await page.goto("/sales/new");
  await page.getByRole("button", { name: "Agregar Corte clásico" }).first().click();
  await page.getByRole("button", { name: "Cobrar" }).click();
  await page.getByRole("button", { name: /Confirmar venta/ }).click();
  await expect(page.getByText("¡Venta registrada!")).toBeVisible();
}

test.describe("Ventas (POS admin)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("crear una venta con pago simple", async ({ page }) => {
    await crearVenta(page);
  });

  test("cancelar una venta desde el historial", async ({ page }) => {
    await crearVenta(page); // garantiza una venta COMPLETADA reciente
    await page.goto("/sales");
    await page.getByTestId("sale-row").first().click();
    await page.getByRole("button", { name: "Cancelar venta" }).click();
    await page.getByRole("button", { name: "Confirmar cancelación" }).click();
    await expect(page.getByText("Venta cancelada correctamente")).toBeVisible();
  });
});
