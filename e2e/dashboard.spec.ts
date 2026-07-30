import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./helpers";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("el filtro de rango se refleja en el panel", async ({ page }) => {
    await page.goto("/dashboard?range=7d");
    await expect(page.getByText("Últimos 7 días").first()).toBeVisible();

    await page.goto("/dashboard?range=month");
    await expect(page.getByText("Este mes").first()).toBeVisible();
  });
});

// Regresión: los filtros de período mandaban a "/", que redirige a /dashboard
// tirando la query. Tocabas "7d" y la pantalla volvía a "Hoy".
test("el período elegido sobrevive a la navegación", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/dashboard");

  await page.getByRole("button", { name: "7d", exact: true }).click();

  await expect(page).toHaveURL(/\/dashboard\?.*range=/);
  // El chip queda marcado como activo: el filtro llegó.
  await expect(page.getByRole("button", { name: "7d", exact: true })).toHaveClass(/bg-blue-600/);
});
