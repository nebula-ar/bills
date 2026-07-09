import { expect, test } from "@playwright/test";

import { ADMIN, loginAsAdmin } from "./helpers";

test.describe("Autenticación admin", () => {
  test("login con credenciales válidas entra al dashboard", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page).toHaveURL("/");
    // Elementos propios del panel de admin.
    await expect(page.getByRole("link", { name: "Vender" })).toBeVisible();
  });

  test("login con contraseña incorrecta muestra error", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").fill(ADMIN.email);
    await page.locator("#password").fill("clave-incorrecta");
    await page.getByRole("button", { name: "Ingresar" }).click();

    await expect(page.locator("#login-error")).toContainText(/incorrect/i);
    // No debe navegar fuera del login.
    await expect(page).toHaveURL(/\/login/);
  });

  test("ruta protegida sin sesión redirige a login", async ({ page }) => {
    await page.goto("/sales");
    await expect(page).toHaveURL(/\/login/);
  });
});
