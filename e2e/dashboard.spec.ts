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

  // Comprar mercadería no es un gasto: la plata sale, pero queda en la góndola.
  // Antes se restaba entera del mes y un mes de reposición fuerte se leía como
  // pérdida.
  test("la mercadería sale de la caja pero no cuenta como gasto del mes", async ({ page }) => {
    await page.goto("/expenses");
    await page.getByRole("button", { name: "Nuevo gasto" }).click();
    await page.getByRole("button", { name: "Cargar un gasto" }).click();
    await page.locator('input[name="amount"]').fill("246800");
    await page.getByRole("button", { name: "Mercadería" }).click();
    // El aviso está antes de guardar, que es cuando sirve.
    await expect(page.getByText(/no baja la ganancia/)).toBeVisible();
    await page.getByRole("button", { name: "Registrar gasto" }).click();

    // En Gastos sí se ve: la plata salió de la caja.
    await expect(page.getByText(/246\.800/).first()).toBeVisible({ timeout: 15_000 });

    // En el dashboard no figura entre los gastos del mes.
    await page.goto("/dashboard?range=month");
    const gastos = page.locator("section", { hasText: "Gastos por categoría" });
    await expect(gastos.getByText("Mercadería")).toHaveCount(0);
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
  // `bg-primary` y no `bg-blue-600`: el color activo salió del componente y
  // pasó a ser una ranura del tema, así que en pastelería el mismo chip es rosa.
  await expect(page.getByRole("button", { name: "7d", exact: true })).toHaveClass(/bg-primary/);
});
