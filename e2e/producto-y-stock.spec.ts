import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./helpers";

// Producto y existencia son la misma cosa para quien atiende: se cargan y se
// gestionan en la misma pantalla. Esto prueba que no haga falta ir a Stock.
test.describe("El producto y su stock, en un solo lugar", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("al dar de alta un producto se puede decir cuántos hay", async ({ page }) => {
    const nombre = `Producto E2E ${Date.now()}`;

    await page.goto("/catalog");
    await page.getByRole("button", { name: /Nuevo/ }).click();

    await page.getByPlaceholder("Ej: Corte clásico").fill(nombre);
    await page.locator('input[name="price"]').fill("5000");
    await page.locator('input[name="stock"]').fill("12");
    await page.locator('input[name="cost"]').fill("3000");
    await page.getByRole("button", { name: /Crear/ }).click();
    await expect(page.getByRole("heading", { name: `Foto de ${nombre}` })).toBeVisible();
    await page.getByRole("button", { name: "Listo" }).click();

    // La existencia queda cargada de una: la lista ya la muestra.
    const fila = page.getByRole("button").filter({ hasText: nombre });
    await expect(fila).toBeVisible({ timeout: 20_000 });
    await expect(fila.getByText("12 un")).toBeVisible();

    // Y el movimiento quedó asentado en el libro, no apareció de la nada.
    await page.goto("/stock");
    await expect(page.getByRole("row").filter({ hasText: nombre }).getByText("12 un")).toBeVisible();
  });

  test("la existencia se ajusta desde la ficha, sin volver a elegir el producto", async ({ page }) => {
    await page.goto("/catalog");
    await page.getByRole("button").filter({ hasText: "Alfajor triple" }).first().click();

    // El panel de stock está en la ficha del producto que ya estaba abierto.
    await expect(page.getByText(/En Sucursal/)).toBeVisible();

    await page.getByRole("button", { name: "Conté", exact: true }).click();
    await page.getByLabel("Lo que hay").fill("77");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();

    await expect(page.getByText("Stock actualizado.")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("77 un").first()).toBeVisible();
  });

  test("una merma descuenta desde la misma ficha", async ({ page }) => {
    await page.goto("/catalog");
    await page.getByRole("button").filter({ hasText: "Chicles" }).first().click();

    // La lista queda visible debajo del modal y también muestra la existencia.
    // Acotamos la aserción al resumen de la ficha: cuando cambia, el
    // router.refresh() del ajuste ya terminó y el formulario no puede ser
    // reemplazado a mitad de la siguiente operación.
    const stockSummary = page.getByText("En Sucursal Centro", { exact: true }).locator("..");

    await page.getByRole("button", { name: "Conté", exact: true }).click();
    await page.getByLabel("Lo que hay").fill("50");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(stockSummary.getByText("50 un", { exact: true })).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "Se perdió" }).click();
    await page.getByLabel("Lo que se perdió").fill("3");
    await page.getByLabel("Motivo").fill("Se cayeron al piso");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();

    await expect(stockSummary.getByText("47 un", { exact: true })).toBeVisible({ timeout: 20_000 });
  });

  test("un rubro sin stock no muestra existencias en el producto", async ({ page }) => {
    async function toggleStock() {
      await page.goto("/settings");
      const row = page.locator("li").filter({ hasText: "Faltantes, movimientos y traspasos" });
      const current = await row.getByRole("button").getAttribute("type");
      if (current !== "submit") throw new Error("El control de Stock no está disponible.");
      const wasEnabled = await row.getByRole("button", { name: "Apagar" }).count();
      await row.getByRole("button").click();
      await expect(
        page
          .locator("li")
          .filter({ hasText: "Faltantes, movimientos y traspasos" })
          .getByRole("button", { name: wasEnabled ? "Prender" : "Apagar" }),
      ).toBeVisible();
    }

    await toggleStock();

    try {
      await page.goto("/catalog");
      await page.getByRole("button").filter({ hasText: "Alfajor triple" }).first().click();
      await expect(page.getByText(/En Sucursal/)).toHaveCount(0);
    } finally {
      // Se restaura pase lo que pase: si queda apagado, ensucia a todos los
      // tests que corren después.
      await toggleStock();
    }
  });
});

// Regresión: un producto sin precio no puede tirar a la basura el stock y el
// costo que la persona acaba de escribir.
test("cargar un producto sin precio conserva el stock y el costo", async ({ page }) => {
  await loginAsAdmin(page);
  const nombre = `Sin precio E2E ${Date.now()}`;

  await page.goto("/catalog");
  await page.getByRole("button", { name: /Nuevo/ }).click();
  await page.getByPlaceholder("Ej: Corte clásico").fill(nombre);
  await page.locator('input[name="stock"]').fill("9");
  await page.locator('input[name="cost"]').fill("500");
  await page.getByRole("button", { name: /Crear/ }).click();
  await expect(page.getByRole("heading", { name: `Foto de ${nombre}` })).toBeVisible();
  await page.getByRole("button", { name: "Listo" }).click();

  const fila = page.getByRole("button").filter({ hasText: nombre });
  await expect(fila).toBeVisible({ timeout: 20_000 });
  await expect(fila.getByText("9 un")).toBeVisible();

  // Y el costo quedó guardado en la ficha.
  await fila.click();
  await page.locator("summary").first().click();
  await expect(page.locator('input[name="cost"]')).toHaveValue("500");
});
