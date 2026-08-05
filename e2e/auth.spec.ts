import { expect, test } from "@playwright/test";
import { Client } from "pg";

import { ADMIN, loginAsAdmin } from "./helpers";

test.describe("Autenticación admin", () => {
  test("login con credenciales válidas entra al desvío", async ({ page, context }) => {
    await loginAsAdmin(page);
    // Entrar ya no cae derecho al panel: primero se elige panel o mostrador.
    await expect(page).toHaveURL("/entrar");
    await expect(page.getByRole("link", { name: /^Panel/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /mostrador/ })).toBeVisible();

    const authCookies = (await context.cookies()).filter((cookie) => cookie.name.startsWith("sb-"));
    expect(authCookies.length).toBeGreaterThan(0);
    for (const cookie of authCookies) {
      expect(cookie.httpOnly).toBe(true);
      expect(cookie.sameSite).toBe("Lax");
    }
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

  test("la sesión sobrevive una recarga y logout la invalida", async ({ page }) => {
    await loginAsAdmin(page);
    await page.reload();
    await expect(page.getByRole("link", { name: /^Panel/ })).toBeVisible();

    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/sales");
    await expect(page).toHaveURL(/\/login/);
  });

  test("un alta pendiente no puede reclamar una identidad desde login", async ({ page }) => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      const business = await client.query<{ id: string }>('SELECT id FROM "Business" ORDER BY "createdAt" LIMIT 1');
      const businessId = business.rows[0]?.id;
      if (!businessId) throw new Error("El seed no creó un negocio para la prueba de identidad.");
      await client.query(
        `INSERT INTO "User" (
          id, "businessId", name, email, role, active, "updatedAt"
        ) VALUES ($1, $2, $3, $4, 'ADMIN', true, now())`,
        ["unlinked-admin-e2e", businessId, "Admin sin identidad", "unlinked@bills.local"],
      );
      await client.query(
        `INSERT INTO "AuthProvisionJob" (
          id, kind, status, "userId", "emailCanonical", "updatedAt"
        ) VALUES ($1, 'REGISTRATION', 'READY', $2, $3, now())`,
        ["unlinked-registration-job-e2e", "unlinked-admin-e2e", "unlinked@bills.local"],
      );
    } finally {
      await client.end();
    }

    await page.goto("/login");
    await page.locator("#email").fill("unlinked@bills.local");
    await page.locator("#password").fill("secret123");
    await page.getByRole("button", { name: "Ingresar" }).click();

    await expect(page.locator("#login-error")).toContainText(/incorrect/i);
    await expect(page).toHaveURL(/\/login/);
  });

  test("login muestra la nueva entrada publica y conserva sus accesos", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("img", { name: "Marca Bills" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Bienvenido de nuevo" })).toBeVisible();
    await expect(page.getByLabel("Email o usuario")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.getByRole("link", { name: "Registrá tu negocio" })).toHaveAttribute("href", "/register");
    await expect(page.getByRole("link", { name: "Ir a la terminal" })).toHaveAttribute("href", "/terminal");
  });

  test("login permite alternar la visibilidad de la contraseña", async ({ page }) => {
    await page.goto("/login");
    const password = page.locator("#password");
    const toggle = page.getByRole("button", { name: "Mostrar contraseña" });

    await expect(password).toHaveAttribute("type", "password");
    await toggle.click();
    await expect(password).toHaveAttribute("type", "text");
    await expect(page.getByRole("button", { name: "Ocultar contraseña" })).toBeVisible();
  });

  test("login móvil no desborda y permite alternar la contraseña con teclado", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");

    await expect(page.locator("#password")).toBeVisible();
    await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(true);

    await page.locator("#password").focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(page.locator("#password")).toHaveAttribute("type", "text");
  });
});
