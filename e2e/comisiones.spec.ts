import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./helpers";

// Comisiones: era un módulo que se podía prender y no hacía nada. Estos tests
// existen para que no vuelva a pasar.
test.describe("Comisiones", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("liquida por empleado sobre lo que vendió", async ({ page }) => {
    await page.goto("/comisiones");

    // El seed pone 10% a todo el equipo y ventas de los últimos 15 días.
    const fila = page.getByRole("row").filter({ hasText: "Nico Fernández" });
    await expect(fila).toBeVisible();
    await expect(fila.getByText("10%")).toBeVisible();
  });

  test("pagar una comisión la registra como gasto", async ({ page }) => {
    await page.goto("/comisiones");

    const fila = page.getByRole("row").filter({ hasText: "Nico Fernández" });
    await fila.locator('input[name="amount"]').fill("5000");
    await fila.getByRole("button", { name: "Pagar" }).click();
    await expect(page.getByText("Comisión pagada y registrada como gasto.")).toBeVisible();

    // Sale de la caja: tiene que aparecer en gastos.
    await page.goto("/expenses");
    await expect(page.getByText(/Comisión de Nico Fernández/).first()).toBeVisible({ timeout: 15_000 });
  });

  test("el porcentaje se edita desde el equipo", async ({ page }) => {
    await page.goto("/staff");
    await page.getByRole("button", { name: /Nico Fernández/ }).first().click();
    await expect(page.getByText("Comisión sobre lo que vende")).toBeVisible();
    await page.locator('input[name="commissionRate"]').fill("20");
    await Promise.all([
      page.waitForURL(/\/staff\?status=success/),
      page.getByRole("button", { name: "Guardar cambios" }).click(),
    ]);

    await page.goto("/comisiones");
    await expect(page.getByRole("row").filter({ hasText: "Nico Fernández" }).getByText("20%")).toBeVisible({
      timeout: 15_000,
    });
  });
});
