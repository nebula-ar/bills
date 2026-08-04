import { expect, type Page } from "@playwright/test";

// Credenciales sembradas por prisma/seed.ts (ver scripts/e2e-prepare.mjs).
export const ADMIN = { email: "owner@bills.local", password: "admin123" };

// Empleados demo (nombre + PIN) tal como los crea el seed.
export const STAFFS = {
  nico: { name: "Nico Fernández", pin: "1111", branch: "Sucursal Centro" },
  lucas: { name: "Lucas Gómez", pin: "2222", branch: "Sucursal Centro" },
};

// Loguea como admin por la UI y espera la app adentro (el desvío de /entrar).
export async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.locator("#email").fill(ADMIN.email);
  await page.locator("#password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  // La nav de admin (Historial) solo aparece con sesión de administrador.
  await expect(page.getByRole("link", { name: "Historial" })).toBeVisible({ timeout: 15_000 });
}

// Elige quién atiende en el mostrador. Con más de un empleado ya no hay
// preselección silenciosa —de ahí salían comisiones mal atribuidas—, así que
// hay que elegir explícitamente igual que en la app real. Con uno solo la app
// ya lo eligió y no hay botones que tocar.
export async function elegirVendedor(page: Page) {
  const opciones = page.getByTestId("staff-option");
  await expect(opciones.first()).toBeVisible({ timeout: 15_000 });
  await opciones.first().click();
}
