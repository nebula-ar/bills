import { expect, test } from "@playwright/test";

import { loginAsAdmin, elegirVendedor } from "./helpers";

// El escáner de códigos. La lectura por cámara no se puede simular headless con
// un código real, así que se ejercita por la entrada manual — que además es una
// función de verdad: sin HTTPS (o con el código roto) es la única forma de cargar.
test.describe("Escáner de códigos", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("un código nuevo abre el alta guiada y crea el producto", async ({ page }) => {
    const code = `779${Date.now()}`.slice(0, 13);

    await page.goto("/catalog");
    await page.getByRole("button", { name: "Escanear" }).click();
    await expect(page.getByRole("heading", { name: "Cargar producto" })).toBeVisible();

    await page.getByRole("button", { name: "Escribir el código a mano" }).click();
    await page.locator('input[name="code"]').fill(code);
    await page.getByRole("button", { name: "Buscar" }).click();

    // Alta guiada: nombre y precio son los únicos obligatorios.
    await expect(page.getByText("¿Qué producto es?")).toBeVisible({ timeout: 15_000 });
    await page.getByPlaceholder("Ej: Alfajor triple").fill("Escaneado E2E");
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(page.getByText("¿A cuánto lo vendés?")).toBeVisible();
    await page.locator('input[inputmode="numeric"]').fill("2500");
    await page.getByRole("button", { name: "Continuar" }).click();

    // Desde el costo en adelante ya se puede guardar.
    await expect(page.getByText("¿Cuánto te costó?")).toBeVisible();
    await page.getByRole("button", { name: "Listo" }).click();

    await expect(page.getByText("Escaneado E2E agregado al catálogo.")).toBeVisible({ timeout: 20_000 });

    // Quedó cargado y con precio, así que se puede vender.
    await page.goto("/catalog");
    await expect(page.getByRole("button").filter({ hasText: "Escaneado E2E" }).first()).toBeVisible();
  });

  test("un código ya cargado avisa en vez de duplicarlo", async ({ page }) => {
    await page.goto("/catalog");
    await page.getByRole("button", { name: "Escanear" }).click();
    await page.getByRole("button", { name: "Escribir el código a mano" }).click();
    // Código del alfajor, sembrado por prisma/seed.ts.
    await page.locator('input[name="code"]').fill("7790001000017");
    await page.getByRole("button", { name: "Buscar" }).click();

    await expect(page.getByTestId("scan-feedback")).toHaveText(/Ya lo tenés/, { timeout: 15_000 });
  });

  test("lo escaneado entra al pedido y se ve abajo, sin cerrar la cámara", async ({ page }) => {
    await page.goto("/sales/new");
    await elegirVendedor(page);
    await page.getByRole("button", { name: "Escanear código" }).click();
    await expect(page.getByRole("heading", { name: "Escanear para vender" })).toBeVisible();

    await page.getByRole("button", { name: "Escribir el código a mano" }).click();
    await page.locator('input[name="code"]').fill("7790001000017");
    await page.getByRole("button", { name: "Buscar" }).click();

    // El renglón aparece en el panel de abajo, con la cámara todavía abierta.
    const pedido = page.getByTestId("scan-cart");
    await expect(pedido.getByText("Alfajor triple")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("scan-review")).toContainText("1.800");

    // Y la cantidad se corrige ahí mismo: 2 alfajores = $3.600.
    await pedido.getByRole("button", { name: "Sumar Alfajor triple" }).click();
    await expect(page.getByTestId("scan-review")).toContainText("3.600");

    // Al revisar, el pedido está cargado en el mostrador.
    await page.getByTestId("scan-review").click();
    await expect(page.getByText(/3\.600/).first()).toBeVisible({ timeout: 15_000 });
  });

  test("lo que se escaneó de más se saca desde el mismo panel", async ({ page }) => {
    await page.goto("/sales/new");
    await elegirVendedor(page);
    await page.getByRole("button", { name: "Escanear código" }).click();
    await page.getByRole("button", { name: "Escribir el código a mano" }).click();
    await page.locator('input[name="code"]').fill("7790001000017");
    await page.getByRole("button", { name: "Buscar" }).click();

    const pedido = page.getByTestId("scan-cart");
    await expect(pedido.getByText("Alfajor triple")).toBeVisible({ timeout: 15_000 });
    await pedido.getByRole("button", { name: "Restar Alfajor triple" }).click();

    // Vuelve a quedar vacío: no hay nada que revisar.
    await expect(page.getByText("Todavía no pasaste nada")).toBeVisible();
    await expect(page.getByTestId("scan-review")).toBeDisabled();
  });

  test("el atajo de bulto carga la caja entera de una", async ({ page }) => {
    await page.goto("/sales/new");
    await elegirVendedor(page);
    await page.getByRole("button", { name: "Escanear código" }).click();
    await page.getByRole("button", { name: "Escribir el código a mano" }).click();
    // Gaseosa: viene en cajas de 12 (ver seed).
    await page.locator('input[name="code"]').fill("7790002000014");
    await page.getByRole("button", { name: "Buscar" }).click();

    const pedido = page.getByTestId("scan-cart");
    await expect(pedido.getByText("Gaseosa 500 ml")).toBeVisible({ timeout: 15_000 });
    await pedido.getByRole("button", { name: /Caja ×12/ }).click();

    // La que se escaneó más la caja: 13 × $2.200 = $28.600
    await expect(page.getByTestId("scan-review")).toContainText("28.600");
  });

  test("un código desconocido en el POS avisa que no está", async ({ page }) => {
    await page.goto("/sales/new");
    await elegirVendedor(page);
    await page.getByRole("button", { name: "Escanear código" }).click();
    await page.getByRole("button", { name: "Escribir el código a mano" }).click();
    await page.locator('input[name="code"]').fill("0000000000000");
    await page.getByRole("button", { name: "Buscar" }).click();

    await expect(page.getByTestId("scan-feedback")).toHaveText(/no está cargado todavía/, { timeout: 15_000 });
  });
});

// El bug real: el mostrador buscaba el código solo en la lista con la que se
// abrió la pantalla. Un producto cargado después decía "no está en el catálogo"
// aunque estuviera cargado.
test.describe("Escanear busca en la base, no solo en memoria", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("encuentra un producto cargado después de abrir el mostrador", async ({ page, context }) => {
    const codigo = `779${Date.now()}`.slice(0, 13);

    // Abrimos el mostrador ANTES de que el producto exista.
    await page.goto("/sales/new");
    await elegirVendedor(page);

    // En otra pestaña lo damos de alta, como pasa en la vida real.
    const otra = await context.newPage();
    await otra.goto("/catalog");
    await otra.getByRole("button", { name: /Nuevo/ }).click();
    await otra.getByPlaceholder("Ej: Corte clásico").fill(`Recién cargado ${codigo}`);
    await otra.locator('input[name="price"]').fill("2500");
    await otra.getByRole("button", { name: /Crear/ }).click();
    await expect(otra.getByRole("button").filter({ hasText: `Recién cargado ${codigo}` })).toBeVisible({
      timeout: 20_000,
    });
    // Le ponemos el código de barras desde la ficha.
    await otra.getByRole("button").filter({ hasText: `Recién cargado ${codigo}` }).click();
    await otra.locator("summary").first().click();
    await otra.locator('input[name="barcode"]').fill(codigo);
    await otra.getByRole("button", { name: "Guardar cambios" }).click();
    await otra.waitForTimeout(2000);
    await otra.close();

    // El mostrador sigue abierto con la lista vieja: escanear igual lo encuentra.
    await page.getByRole("button", { name: "Escanear código" }).click();
    await page.getByRole("button", { name: "Escribir el código a mano" }).click();
    await page.locator('input[name="code"]').fill(codigo);
    await page.getByRole("button", { name: "Buscar" }).click();

    await expect(page.getByTestId("scan-review")).toContainText("2.500", { timeout: 20_000 });
  });

  test("un producto apagado en la sucursal lo dice con todas las letras", async ({ page }) => {
    const codigo = `778${Date.now()}`.slice(0, 13);

    // Se crea con precio y después se apaga: queda cargado pero no vendible acá.
    await page.goto("/catalog");
    await page.getByRole("button", { name: /Nuevo/ }).click();
    await page.getByPlaceholder("Ej: Corte clásico").fill(`Apagado ${codigo}`);
    await page.locator('input[name="price"]').fill("3000");
    await page.getByRole("button", { name: /Crear/ }).click();
    await expect(page.getByRole("button").filter({ hasText: `Apagado ${codigo}` })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button").filter({ hasText: `Apagado ${codigo}` }).click();
    await page.locator("summary").first().click();
    await page.locator('input[name="barcode"]').fill(codigo);
    await page.getByLabel("Disponible para vender").uncheck();
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await page.waitForTimeout(2000);

    await page.goto("/sales/new");
    await elegirVendedor(page);
    await page.getByRole("button", { name: "Escanear código" }).click();
    await page.getByRole("button", { name: "Escribir el código a mano" }).click();
    await page.locator('input[name="code"]').fill(codigo);
    await page.getByRole("button", { name: "Buscar" }).click();

    // No dice "no está en el catálogo", que era la mentira.
    await expect(page.getByTestId("scan-feedback")).toContainText(/apagado para vender/, { timeout: 20_000 });
  });
});

// El código de barras es el mismo en todo el mundo, así que sirve para traer el
// nombre y la foto del producto sin que nadie escriba ni fotografíe nada. Se
// prueba con un código real contra la base pública; si no hay internet, se saltea
// (que es exactamente lo que hace la app: seguir a mano).
test.describe("El código trae el producto", () => {
  // Nutella: está en la base pública desde hace años y tiene foto.
  const CODIGO_REAL = "3017620422003";

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("un código conocido llega con el nombre puesto y la foto del producto", async ({ page }) => {
    const alcanzable = await fetch(`https://world.openfoodfacts.org/api/v2/product/${CODIGO_REAL}.json?fields=code`, {
      headers: { "User-Agent": "Bills/1.0 (e2e)" },
      signal: AbortSignal.timeout(8_000),
    })
      .then((response) => response.ok)
      .catch(() => false);

    test.skip(!alcanzable, "sin internet no hay base pública que consultar");

    await page.goto("/catalog");
    await page.getByRole("button", { name: "Escanear" }).click();
    await page.getByRole("button", { name: "Escribir el código a mano" }).click();
    await page.locator('input[name="code"]').fill(CODIGO_REAL);
    await page.getByRole("button", { name: "Buscar" }).click();

    // El nombre viene escrito: el primer paso es confirmar, no tipear.
    await expect(page.getByText("¿Qué producto es?")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByPlaceholder("Ej: Alfajor triple")).toHaveValue(/Nutella/i);

    // Y la foto es la del producto, no la del código de barras.
    await expect(page.getByText("Foto y nombre traídos del código")).toBeVisible();
    await expect(page.getByRole("button", { name: "Quitar foto" })).toHaveCount(0);

    await page.getByRole("button", { name: "Continuar" }).click();
    await page.locator('input[inputmode="numeric"]').fill("9000");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: "Listo" }).click();

    await expect(page.getByText(/agregado al catálogo/)).toBeVisible({ timeout: 25_000 });

    // La foto quedó guardada: el servidor la bajó solo, nadie subió nada.
    await page.goto("/catalog");
    const ficha = page.getByRole("button").filter({ hasText: /Nutella/i }).first();
    await expect(ficha).toBeVisible();
    await expect(ficha.locator("img")).toBeVisible();
  });
});
