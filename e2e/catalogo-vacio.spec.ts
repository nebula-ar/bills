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

  // Cae en el desvío (panel o mostrador). El aviso del catálogo vive en el panel.
  await page.getByRole("link", { name: /^Panel/ }).click({ timeout: 20_000 });
  const aviso = page.getByRole("link", { name: /Cargá tus productos/ });
  await expect(aviso).toBeVisible({ timeout: 20_000 });
  await aviso.click();

  // El catálogo vacío ofrece las tres salidas.
  await expect(page.getByRole("heading", { name: /Todavía no cargaste tus productos/i })).toBeVisible();
  await expect(page.getByText(/Traer los productos de verdulería o fiambrería/i)).toBeVisible();
  await expect(page.getByText("Escanear códigos de barras")).toBeVisible();
  await expect(page.getByText("Cargar a mano")).toBeVisible();

  // Muestra qué se va a crear antes de tocar nada.
  await expect(page.getByText("Banana")).toBeVisible();

  await page.getByRole("button", { name: /^Traer los/ }).click();

  // Los productos quedan cargados con su unidad de venta (la banana va por kg).
  // `exact` porque el catálogo de verdulería trae variantes del mismo nombre
  // (Tomate, Tomate cherry, Tomate perita) y sin eso el locator matchea tres.
  await expect(page.getByText("Banana", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Tomate", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Todavía no cargaste tus/i })).toHaveCount(0);

  // Entran con precio de referencia, no en cero. El cero se vería como
  // "Disponible · $ 0" y se podrían vender tomates a cero pesos sin que nada
  // avise; sin precio directamente no se podrían vender. Un valor real, que el
  // dueño revisa, es lo único que sirve el mismo día.
  await expect(page.getByText("Sin precio")).toHaveCount(0);
  await expect(page.getByText("$ 0", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Disponible").first()).toBeVisible();

  // Y el panel deja de avisar.
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: /Cargá tus productos/ })).toHaveCount(0);
});

// La contracara: lo que se siembra tiene que poder venderse el mismo día. El
// mostrador arma su lista desde los precios de la sucursal, así que esto prueba
// de punta a punta que el precio de referencia llegó hasta la venta.
test("lo que se siembra se puede vender el mismo día", async ({ page }) => {
  const unique = Date.now();

  await page.goto("/register");
  await page.getByRole("button", { name: "Empezar" }).click();
  const continuar = page.getByRole("button", { name: "Continuar" });
  await page.getByRole("button", { name: /Verdulería o fiambrería/ }).click();
  await continuar.click();
  await page.getByPlaceholder("Ej: Verdulería La Huerta").fill(`Verdulería sin precios ${unique}`);
  await continuar.click();
  await page.getByPlaceholder("Ej: Matías").fill("Dueño E2E");
  await continuar.click();
  await page.getByPlaceholder("tucorreo@ejemplo.com").fill(`e2e-sinprecio-${unique}@test.local`);
  await continuar.click();
  await page.getByPlaceholder("Al menos 6 caracteres").fill("secret123");
  await continuar.click();
  await page.getByRole("button", { name: /Crear mi negocio/ }).click();
  await page.waitForURL(/\/entrar$|dashboard/, { timeout: 20_000 });

  await page.goto("/catalog");
  await page.getByRole("button", { name: /^Traer los/ }).click();
  await expect(page.getByText("Banana", { exact: true })).toBeVisible({ timeout: 20_000 });

  // Y llegan al mostrador con su precio, listos para cobrar.
  await page.goto("/sales/new");
  await expect(page.getByText("Banana", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("$ 2.400").first()).toBeVisible();
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

  await page.waitForURL(/\/entrar$|dashboard/, { timeout: 20_000 });
  await page.goto("/catalog");

  // Una barbería cotiza servicios: el texto lo dice.
  await expect(page.getByText(/Traer los servicios de barbería o peluquería/i)).toBeVisible();
  await page.getByRole("button", { name: /^Traer los/ }).click();
  await expect(page.getByText("Corte clásico")).toBeVisible({ timeout: 20_000 });

  // Cada servicio aparece una sola vez (el alta es idempotente por nombre) y el
  // onboarding ya no se muestra, porque el catálogo dejó de estar vacío.
  await expect(page.getByRole("button").filter({ hasText: "Corte clásico" })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: /Todavía no cargaste tus/i })).toHaveCount(0);

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
  await page.waitForURL(/\/entrar$|dashboard/, { timeout: 20_000 });

  await page.goto("/catalog");
  // Ni el botón del header, ni la opción de escanear del catálogo vacío, ni el
  // botón de talles.
  await expect(page.getByRole("button", { name: "Escanear" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Con talles" })).toHaveCount(0);
  await expect(page.getByText("Escanear códigos de barras")).toHaveCount(0);
  // Pero sí ofrece lo que le sirve.
  await expect(page.getByText(/Traer los servicios de barbería/i)).toBeVisible();

  await page.getByRole("button", { name: /^Traer los/ }).click();
  await expect(page.getByText("Corte clásico")).toBeVisible({ timeout: 20_000 });

  await page.goto("/sales/new");
  await elegirVendedor(page);
  await expect(page.getByRole("button", { name: "Escanear código" })).toHaveCount(0);
  await expect(page.getByPlaceholder("Buscar servicio…")).toBeVisible();
});
