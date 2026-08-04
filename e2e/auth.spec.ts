import { expect, test } from "@playwright/test";

import { ADMIN, loginAsAdmin } from "./helpers";

test.describe("Autenticación admin", () => {
  test("login con credenciales válidas entra al desvío", async ({ page }) => {
    await loginAsAdmin(page);
    // Entrar ya no cae derecho al panel: primero se elige panel o mostrador.
    await expect(page).toHaveURL("/entrar");
    await expect(page.getByRole("link", { name: /^Panel/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /mostrador/ })).toBeVisible();
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
