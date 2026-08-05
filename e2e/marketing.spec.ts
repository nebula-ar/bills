import { expect, test } from "@playwright/test";

import { loginAsAdmin, elegirVendedor } from "./helpers";

// Marketing: usar los datos que el negocio ya tiene para que el cliente vuelva.
test.describe("Marketing", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("lista a los clientes que hace rato no vuelven, con su WhatsApp listo", async ({ page }) => {
    await page.goto("/marketing");

    await expect(page.getByRole("heading", { name: "Clientes que no vuelven" })).toBeVisible();

    // El umbral se puede mover: no es lo mismo un kiosco que una barbería.
    await page.getByRole("link", { name: "30d", exact: true }).click();
    await expect(page).toHaveURL(/dias=30/);

    const escribir = page.getByRole("link", { name: "Escribirle" }).first();
    await expect(escribir).toBeVisible();

    const href = decodeURIComponent((await escribir.getAttribute("href")) ?? "");
    // Número normalizado y mensaje del negocio.
    expect(href).toMatch(/^https:\/\/wa\.me\/549\d+\?text=/);
    expect(href).toContain("Kiosco El Rulo");
    // No reclama: el mensaje no lleva la cantidad de días.
    expect(href).not.toContain("días");
  });

  test("muestra los cumpleaños del mes con el saludo listo", async ({ page }) => {
    await page.goto("/marketing");

    // El seed deja dos clientes cumpliendo este mes.
    await expect(page.getByRole("heading", { name: "Cumpleaños del mes" })).toBeVisible();

    const saludar = page.getByRole("link", { name: "Saludar" }).first();
    await expect(saludar).toBeVisible();

    const href = decodeURIComponent((await saludar.getAttribute("href")) ?? "");
    expect(href).toContain("Feliz cumple");
  });

  test("los mejores clientes salen con lo que gastaron", async ({ page }) => {
    await page.goto("/marketing");

    await expect(page.getByRole("heading", { name: "Tus mejores clientes" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Avisarle" }).first()).toBeVisible();
  });

  test("detecta lo que se vende junto", async ({ page }) => {
    await page.goto("/marketing");

    await expect(page.getByRole("heading", { name: "Se venden juntos" })).toBeVisible();
    await expect(page.getByText(/Juntos en \d+ ventas/).first()).toBeVisible();
  });

  test("los puntos del cliente se ven en su ficha y se pueden canjear", async ({ page }) => {
    await page.goto("/customers");
    const rodrigoUrl = await page.getByRole("link", { name: "Rodrigo Pérez" }).getAttribute("href");
    expect(rodrigoUrl).toBeTruthy();
    await page.goto(rodrigoUrl!);

    // El programa viene configurado en el seed: $1.000 = 1 punto, $50 el punto.
    await expect(page.getByText("Puntos", { exact: true })).toBeVisible();

    const canjear = page.getByRole("button", { name: "Canjear" });
    await expect(canjear).toBeVisible();
    await canjear.click();

    await expect(page.getByText(/Canjeaste \d+ puntos por \$/)).toBeVisible();
    // El toast confirma la escritura; esperamos además que termine el
    // router.refresh() antes de iniciar otra navegación.
    await expect(canjear).toBeHidden();

    // El canje deja crédito en la cuenta: la deuda del cliente bajó.
    await page.goto(rodrigoUrl!);
    await expect(page.getByRole("listitem").filter({ hasText: "Canje de" }).first()).toBeVisible();
  });

  test("una venta con cliente suma puntos", async ({ page }) => {
    await page.goto("/sales/new");
    await elegirVendedor(page);
    await page.getByRole("button", { name: "Agregar Alfajor triple" }).first().click();
    await page.getByRole("button", { name: "Sumar Alfajor triple" }).first().click();
    await page.getByRole("button", { name: "Cobrar" }).click();
    // Se elige el primero de la lista y se lee su nombre: la etiqueta cambia
    // cuando el cliente debe plata ("Fulano — debe $X"), así que no se puede
    // buscar por texto exacto.
    const selector = page.getByLabel("Cliente");
    await selector.selectOption({ index: 1 });
    const elegido = ((await selector.locator("option").nth(1).textContent()) ?? "").split("—")[0].trim();
    await page.getByRole("button", { name: /Confirmar venta/ }).click();
    await expect(page.getByText("¡Venta registrada!")).toBeVisible();

    // La ficha muestra los puntos acumulados y su equivalente en pesos.
    await page.goto("/customers");
    await page.getByRole("link", { name: elegido }).click();
    await expect(page.getByText("Puntos", { exact: true })).toBeVisible();
    await expect(page.getByText(/= \$/)).toBeVisible();
  });

  test("un kiosco no tiene página pública: no vende por link", async ({ page }) => {
    await page.goto("/marketing");

    await expect(page.getByRole("heading", { name: "Configuración" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tu página pública" })).toHaveCount(0);
  });
});

// La página pública se prueba sobre un negocio propio y no sobre el sembrado:
// cambiarle el rubro al kiosco dejaría sucios los tests que corren después.
test.describe("Página pública del negocio", () => {
  // Cada test crea su propio negocio de cero (alta completa + configuración),
  // así que necesita más aire que los 30s por defecto.
  test.setTimeout(90_000);

  async function crearBarberia(page: import("@playwright/test").Page, nombre: string) {
    await page.goto("/register");
    await page.getByRole("button", { name: "Empezar" }).click();
    const continuar = page.getByRole("button", { name: "Continuar" });
    await page.getByRole("button", { name: /Barbería o peluquería/ }).click();
    await continuar.click();
    await page.getByPlaceholder("Ej: Barbería Don Julio").fill(nombre);
    await continuar.click();
    await page.getByPlaceholder("Ej: Matías").fill("Dueño E2E");
    await continuar.click();
    await page.getByPlaceholder("tucorreo@ejemplo.com").fill(`e2e-mkt-${Date.now()}@test.local`);
    await continuar.click();
    await page.getByPlaceholder("Al menos 6 caracteres").fill("secret123");
    await continuar.click();
    await page.getByRole("button", { name: /Crear mi negocio/ }).click();
    await page.waitForURL(/\/entrar$|dashboard/, { timeout: 20_000 });
  }

  async function prenderPagina(page: import("@playwright/test").Page) {
    await page.goto("/marketing");
    await expect(page.getByRole("heading", { name: "Tu página pública" })).toBeVisible();
    await page.locator('input[name="publicPageActive"]').check();
    await page.getByRole("button", { name: "Guardar" }).click();

    // El link aparece recién cuando la página queda prendida.
    const link = page.locator("span.font-mono").first();
    await expect(link).toBeVisible({ timeout: 20_000 });
    return (await link.textContent()) ?? "";
  }

  test("una barbería toma reservas por su link, sin sesión", async ({ page, context }) => {
    await crearBarberia(page, `Barbería Pública ${Date.now()}`);
    const url = await prenderPagina(page);

    expect(url).toMatch(/\/n\/[\w-]+$/);

    // Sesión limpia: el cliente no tiene cuenta.
    const anon = await context.browser()!.newContext();
    const anonPage = await anon.newPage();
    await anonPage.goto(url);

    await expect(anonPage.getByText("Reservá tu turno")).toBeVisible();

    await anonPage.getByRole("button", { name: /^\d{2}:\d{2}$/ }).first().click();
    await anonPage.getByPlaceholder("Ej: Juan").fill("Cliente E2E");
    await anonPage.getByPlaceholder("11 5555-5555").fill("11 5555-9999");
    await anonPage.getByRole("button", { name: "Reservar turno" }).click();

    await expect(anonPage.getByRole("heading", { name: "¡Turno reservado!" })).toBeVisible({ timeout: 20_000 });
    await anon.close();

    // Y el turno cae en la agenda del negocio. Puede haber quedado para mañana:
    // si el local ya cerró, la página pública ofrece el próximo día abierto.
    await page.goto("/turnos");

    if ((await page.getByText("Cliente E2E").count()) === 0) {
      await page.getByRole("link", { name: /Día siguiente/ }).click();
    }

    await expect(page.getByText("Cliente E2E")).toBeVisible({ timeout: 15_000 });
  });

  test("sin nombre ni teléfono no deja reservar", async ({ page, context }) => {
    await crearBarberia(page, `Barbería Validación ${Date.now()}`);
    const url = await prenderPagina(page);

    const anon = await context.browser()!.newContext();
    const anonPage = await anon.newPage();
    await anonPage.goto(url);

    await anonPage.getByRole("button", { name: /^\d{2}:\d{2}$/ }).first().click();
    await expect(anonPage.getByRole("button", { name: "Reservar turno" })).toBeDisabled();

    await anonPage.getByPlaceholder("Ej: Juan").fill("Ana");
    await expect(anonPage.getByRole("button", { name: "Reservar turno" })).toBeDisabled();

    await anonPage.getByPlaceholder("11 5555-5555").fill("1155559999");
    await expect(anonPage.getByRole("button", { name: "Reservar turno" })).toBeEnabled();
    await anon.close();
  });

  test("apagar la página deja el link muerto en el acto", async ({ page, context }) => {
    await crearBarberia(page, `Barbería Apagada ${Date.now()}`);
    const url = await prenderPagina(page);

    await page.locator('input[name="publicPageActive"]').uncheck();
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.locator("span.font-mono")).toHaveCount(0, { timeout: 20_000 });

    const anon = await context.browser()!.newContext();
    const anonPage = await anon.newPage();
    await anonPage.goto(url);

    // Lo que importa es que el cliente no pueda reservar más. (El status sigue
    // siendo 200 porque Next ya empezó a mandar el shell cuando corre el
    // notFound: lo que cambia es lo que se ve.)
    await expect(anonPage.getByText("Reservá tu turno")).toHaveCount(0);
    await expect(anonPage.getByRole("button", { name: "Reservar turno" })).toHaveCount(0);
    await anon.close();
  });
});
