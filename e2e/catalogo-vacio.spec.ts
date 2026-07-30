import { expect, test } from "@playwright/test";

import { elegirVendedor } from "./helpers";

// El negocio nace con el catálogo vacío (el alta ya no lo pregunta) y lo carga
// desde adentro de la app. Este test recorre justamente eso: registro → panel
// avisando → catálogo con sus tres salidas → cargar los típicos del rubro.
test("un negocio nuevo carga su catálogo desde adentro de la app", async ({ page }) => {
  const unique = Date.now();

  await page.goto("/register");
  await page.getByRole("button", { name: "Empezar" }).click();

  const continuar = page.getByRole("button", { name: "Continuar" });
  await page.getByRole("button", { name: /Verdulería o fiambrería/ }).click();
  await continuar.click();
  await page.getByPlaceholder("Ej: Verdulería La Huerta").fill(`Verdulería E2E ${unique}`);
  await continuar.click();
  await page.getByPlaceholder("Ej: Matías").fill("Dueño E2E");
  await continuar.click();
  await page.getByPlaceholder("tucorreo@ejemplo.com").fill(`e2e-catalogo-${unique}@test.local`);
  await continuar.click();
  await page.getByPlaceholder("Al menos 6 caracteres").fill("secret123");
  await continuar.click();
  await page.getByRole("button", { name: /Crear mi negocio/ }).click();

  // Cae en el panel, que avisa que falta el catálogo.
  const aviso = page.getByRole("link", { name: /Cargá tus productos/ });
  await expect(aviso).toBeVisible({ timeout: 20_000 });
  await aviso.click();

  // El catálogo vacío ofrece las tres salidas.
  await expect(page.getByRole("heading", { name: "Tu catálogo está vacío" })).toBeVisible();
  await expect(page.getByText(/Cargar los típicos de verdulería o fiambrería/i)).toBeVisible();
  await expect(page.getByText("Escanear lo que tenés en el mostrador")).toBeVisible();
  await expect(page.getByText("Cargar uno a mano")).toBeVisible();

  // Muestra qué se va a crear antes de tocar nada.
  await expect(page.getByText("Banana")).toBeVisible();

  await page.getByRole("button", { name: "Cargar y revisar precios" }).click();

  // Los productos quedan cargados con su unidad de venta (la banana va por kg).
  await expect(page.getByText("Banana")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Tomate")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tu catálogo está vacío" })).toHaveCount(0);

  // Y el panel deja de avisar.
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Cargá tus productos/ })).toHaveCount(0);
});

test("el catálogo sugerido habla el idioma del rubro y no se duplica", async ({ page }) => {
  const unique = Date.now();

  await page.goto("/register");
  await page.getByRole("button", { name: "Empezar" }).click();
  const continuar = page.getByRole("button", { name: "Continuar" });
  await page.getByRole("button", { name: /Barbería o peluquería/ }).click();
  await continuar.click();
  await page.getByPlaceholder("Ej: Barbería Don Julio").fill(`Barbería E2E ${unique}`);
  await continuar.click();
  await page.getByPlaceholder("Ej: Matías").fill("Dueño E2E");
  await continuar.click();
  await page.getByPlaceholder("tucorreo@ejemplo.com").fill(`e2e-dup-${unique}@test.local`);
  await continuar.click();
  await page.getByPlaceholder("Al menos 6 caracteres").fill("secret123");
  await continuar.click();
  await page.getByRole("button", { name: /Crear mi negocio/ }).click();

  await page.waitForURL(/\/$|dashboard/, { timeout: 20_000 });
  await page.goto("/catalog");

  // Una barbería cotiza servicios: el texto lo dice.
  await expect(page.getByText(/Cargar los típicos de barbería o peluquería/i)).toBeVisible();
  await page.getByRole("button", { name: "Cargar y revisar precios" }).click();
  await expect(page.getByText("Corte clásico")).toBeVisible({ timeout: 20_000 });

  // Cada servicio aparece una sola vez (el alta es idempotente por nombre) y el
  // onboarding ya no se muestra, porque el catálogo dejó de estar vacío.
  await expect(page.getByRole("button").filter({ hasText: "Corte clásico" })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Tu catálogo está vacío" })).toHaveCount(0);

  await page.goto("/catalog");
  await expect(page.getByRole("button").filter({ hasText: "Corte clásico" })).toHaveCount(1);
});

// Una barbería no escanea un corte de pelo: donde no hay códigos, no hay lector.
test("una barbería no muestra el escáner ni en el catálogo ni en el mostrador", async ({ page }) => {
  const unique = Date.now();

  await page.goto("/register");
  await page.getByRole("button", { name: "Empezar" }).click();
  const continuar = page.getByRole("button", { name: "Continuar" });
  await page.getByRole("button", { name: /Barbería o peluquería/ }).click();
  await continuar.click();
  await page.getByPlaceholder("Ej: Barbería Don Julio").fill(`Barbería sin lector ${unique}`);
  await continuar.click();
  await page.getByPlaceholder("Ej: Matías").fill("Dueño E2E");
  await continuar.click();
  await page.getByPlaceholder("tucorreo@ejemplo.com").fill(`e2e-nolector-${unique}@test.local`);
  await continuar.click();
  await page.getByPlaceholder("Al menos 6 caracteres").fill("secret123");
  await continuar.click();
  await page.getByRole("button", { name: /Crear mi negocio/ }).click();
  await page.waitForURL(/\/$|dashboard/, { timeout: 20_000 });

  await page.goto("/catalog");
  // Ni el botón del header, ni la opción de escanear del catálogo vacío, ni el
  // botón de talles.
  await expect(page.getByRole("button", { name: "Escanear" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Con talles" })).toHaveCount(0);
  await expect(page.getByText("Escanear lo que tenés en el mostrador")).toHaveCount(0);
  // Pero sí ofrece lo que le sirve.
  await expect(page.getByText(/Cargar los típicos de barbería/i)).toBeVisible();

  await page.getByRole("button", { name: "Cargar y revisar precios" }).click();
  await expect(page.getByText("Corte clásico")).toBeVisible({ timeout: 20_000 });

  await page.goto("/sales/new");
  await elegirVendedor(page);
  await expect(page.getByRole("button", { name: "Escanear código" })).toHaveCount(0);
  await expect(page.getByPlaceholder("Buscar servicio…")).toBeVisible();
});
