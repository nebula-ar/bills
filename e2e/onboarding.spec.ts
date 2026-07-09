import { expect, test } from "@playwright/test";

// Registro completo por el wizard (4 pasos) → queda logueado en el dashboard.
test("onboarding: crear una barbería nueva desde el wizard", async ({ page }) => {
  const unique = Date.now();
  await page.goto("/register");

  // Paso 1: nombre del negocio
  await page.locator("#businessName").fill(`Barbería E2E ${unique}`);
  await page.getByRole("button", { name: "Continuar" }).click();

  // Paso 2: cuenta del owner
  await page.locator("#ownerName").fill("Owner E2E");
  await page.locator("#email").fill(`e2e-${unique}@test.local`);
  await page.locator("#password").fill("secret123");
  await page.getByRole("button", { name: "Continuar" }).click();

  // Paso 3: ¿atendés? (dejamos que no)
  await page.getByRole("button", { name: "Continuar" }).click();

  // Paso 4: primera sucursal
  await page.getByPlaceholder("Nombre (ej: Sucursal Centro)").fill("Central E2E");
  await page.getByRole("button", { name: "Crear mi barbería" }).click();

  // Tras crear + login, cae en el panel de admin.
  await expect(page.getByRole("link", { name: "Historial" })).toBeVisible({ timeout: 20_000 });
});
