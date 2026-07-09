import { expect, type Page } from "@playwright/test";

// Credenciales sembradas por prisma/seed.ts (ver scripts/e2e-prepare.mjs).
export const ADMIN = { email: "owner@barber-bills.local", password: "admin123" };

// Barberos demo (nombre + PIN) tal como los crea el seed.
export const BARBERS = {
  nico: { name: "Nico Fernández", pin: "1111", branch: "Sucursal Centro" },
  lucas: { name: "Lucas Gómez", pin: "2222", branch: "Sucursal Centro" },
};

// Loguea como admin por la UI y espera el dashboard.
export async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.locator("#email").fill(ADMIN.email);
  await page.locator("#password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  // La nav de admin (Historial) solo aparece con sesión de administrador.
  await expect(page.getByRole("link", { name: "Historial" })).toBeVisible({ timeout: 15_000 });
}
