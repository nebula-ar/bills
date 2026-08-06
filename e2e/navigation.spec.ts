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
      // La home es el desvío entre panel y mostrador; las otras rutas conservan
      // la navegación de administración. Ambos casos prueban que no cayó en el
      // error boundary con la sesión real del seed.
      if (route === "/") {
        await expect(page).toHaveURL(/\/entrar$/);
        await expect(page.getByRole("link", { name: /^Panel/ })).toBeVisible();
      } else {
        await expect(page.getByRole("link", { name: "Historial" })).toBeVisible();
      }
      await expect(page.getByText("Algo salió mal")).toHaveCount(0);
    });
  }
});
