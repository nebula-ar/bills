import { expect, test } from "@playwright/test";

// Registro por el wizard (un dato por paso) → queda logueado en el panel.
// El rubro se elige PRIMERO porque renombra todo lo que sigue, y la sucursal
// no se pregunta: el primer local se llama como el negocio.
test("onboarding: crear un negocio nuevo eligiendo rubro", async ({ page }) => {
  const unique = Date.now();
  await page.goto("/register");

  await page.getByRole("button", { name: "Empezar" }).click();

  const continuar = page.getByRole("button", { name: "Continuar" });

  // 1. Rubro: verdulería, que trae stock y venta por peso.
  await page.getByRole("button", { name: /Verdulería o fiambrería/ }).click();
  await continuar.click();

  // 2. Nombre del negocio, con el ejemplo del rubro elegido.
  await page.getByPlaceholder("Ej: Verdulería La Huerta").fill(`Negocio E2E ${unique}`);
  await continuar.click();

  // 3. Nombre del dueño
  await page.getByPlaceholder("Ej: Matías").fill("Owner E2E");
  await continuar.click();

  // 4. Email
  await page.getByPlaceholder("tucorreo@ejemplo.com").fill(`e2e-${unique}@test.local`);
  await continuar.click();

  // 5. Contraseña
  await page.getByPlaceholder("Al menos 6 caracteres").fill("secret123");
  await continuar.click();

  // 6. Quién atiende: por defecto el dueño, así que no hay nada que escribir.
  // Es el último paso: el catálogo se carga después, ya adentro de la app.
  await expect(page.getByText("Yo atiendo")).toBeVisible();
  await page.getByRole("button", { name: /Crear mi negocio/ }).click();

  // Tras crear + login, cae en el panel de admin.
  await expect(page.getByRole("link", { name: "Historial" })).toBeVisible({ timeout: 20_000 });
});

test("onboarding: habla el idioma del rubro y no pregunta dos veces por el local", async ({ page }) => {
  await page.goto("/register");
  await page.getByRole("button", { name: "Empezar" }).click();

  // Barbería: servicios y barberos, no "productos" ni "vendedores".
  await page.getByRole("button", { name: /Barbería o peluquería/ }).click();
  const continuar = page.getByRole("button", { name: "Continuar" });
  await continuar.click();

  await expect(page.getByPlaceholder("Ej: Barbería Don Julio")).toBeVisible();
  // El único paso que pregunta un nombre de local es este, y avisa que el
  // primer local se llama igual que el negocio.
  await expect(page.getByText("Tu primer local se llama igual")).toBeVisible();
  await page.getByPlaceholder("Ej: Barbería Don Julio").fill("Barbería E2E");
  await continuar.click();

  await page.getByPlaceholder("Ej: Matías").fill("Dueño E2E");
  await continuar.click();
  await page.getByPlaceholder("tucorreo@ejemplo.com").fill(`e2e-barber-${Date.now()}@test.local`);
  await continuar.click();
  await page.getByPlaceholder("Al menos 6 caracteres").fill("secret123");
  await continuar.click();

  // Quien atiende se nombra como en el rubro, y es el último paso (6 de 6).
  await expect(page.getByText(/Quedás cargado como barbero/)).toBeVisible();
  await expect(page.getByText("6/6")).toBeVisible();

  // Nunca apareció un paso de sucursal aparte.
  await expect(page.getByPlaceholder("Ej: Sucursal Centro")).toHaveCount(0);
});
