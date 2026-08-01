import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./helpers";

// Smoke: cada pantalla de admin renderiza contra datos reales sembrados, sin caer
// en el error boundary. Cubre que ninguna query/página explote.
const ADMIN_ROUTES = [
  "/",
  "/sales",
  "/sales/new",
  "/pos",
  "/expenses",
  "/caja",
  "/branches",
  "/catalog",
  "/staff",
  "/terminals",
  "/stock",
  "/promotions",
  "/customers",
  "/settings",
];

test.describe("Navegación admin (smoke)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const route of ADMIN_ROUTES) {
    test(`carga ${route} sin errores`, async ({ page }) => {
      await page.goto(route);
      // La nav de admin sigue montada (layout ok) y no aparece el error boundary.
      await expect(page.getByRole("link", { name: "Historial" })).toBeVisible();
      await expect(page.getByText("Algo salió mal")).toHaveCount(0);
    });
  }
});
