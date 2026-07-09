import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./helpers";

test.describe("Gastos", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("registrar un gasto nuevo", async ({ page }) => {
    await page.goto("/expenses");
    await page.getByRole("button", { name: "Nuevo gasto" }).click();
    // Monto (categoría/cuenta/fecha tienen valores por defecto).
    await page.locator('input[name="amount"]').fill("13579");
    await page.getByRole("button", { name: "Registrar gasto" }).click();
    // El gasto aparece en la lista del mes.
    await expect(page.getByText(/13\.579/).first()).toBeVisible();
  });

  test("navegar al mes anterior", async ({ page }) => {
    await page.goto("/expenses");
    await page.getByRole("button", { name: "Mes anterior" }).click();
    await expect(page).toHaveURL(/month=\d{4}-\d{2}/);
  });
});
