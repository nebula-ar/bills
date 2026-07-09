import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./helpers";

test.describe("Caja", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("cargar saldo inicial de una cuenta", async ({ page }) => {
    await page.goto("/caja");
    await page.getByRole("button", { name: "Saldo inicial" }).click();
    await page.locator('input[name="opening_CASH"]').fill("50000");
    await page.getByRole("button", { name: "Guardar saldos" }).click();
    // Al haber saldo inicial, el detalle de la cuenta muestra "Inicial ...".
    await expect(page.getByText(/Inicial/).first()).toBeVisible();
  });

  test("registrar una transferencia entre cuentas", async ({ page }) => {
    await page.goto("/caja");
    await page.getByRole("button", { name: "Transferencia" }).click();
    await page.locator('input[name="amount"]').fill("10000");
    await page.getByRole("button", { name: "Registrar transferencia" }).click();
    await expect(page.getByText(/10\.000/).first()).toBeVisible();
  });

  test("cerrar caja (arqueo) sin diferencia", async ({ page }) => {
    await page.goto("/caja");
    // "Cerrar caja" aparece dos veces: botón de acción (abre) y submit del sheet.
    await page.getByRole("button", { name: "Cerrar caja" }).first().click();
    await page.getByRole("button", { name: "Cerrar caja" }).last().click();
    await expect(page.getByText("Sin diferencia").first()).toBeVisible();
  });
});
