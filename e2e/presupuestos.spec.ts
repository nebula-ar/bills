import { expect, test } from "@playwright/test";

import { elegirVendedor, loginAsAdmin } from "./helpers";

// Presupuestos: cotizar, compartir el link público y convertirlo en venta.
// Lo que se prueba es el circuito completo, porque el valor está justamente en
// que lo cotizado y lo cobrado sean el mismo número.
test.describe("Presupuestos", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("un presupuesto suma sus renglones y queda listado", async ({ page }) => {
    await page.goto("/presupuestos/nuevo");

    const primero = page.locator("form, div").first();
    void primero;

    // Renglón del catálogo: trae nombre y precio solos.
    await page.getByLabel("Producto del catálogo").first().selectOption({ label: "Alfajor triple" });
    await page.getByLabel("Cantidad").first().fill("10");

    // Renglón libre: la mano de obra no está en el catálogo.
    await page.getByRole("button", { name: "Agregar renglón" }).click();
    await page.getByLabel("Descripción").nth(1).fill("Flete");
    await page.getByLabel("Cantidad").nth(1).fill("1");
    await page.getByLabel("Precio unitario").nth(1).fill("5000");

    // El total se ve mientras se arma: 10 alfajores a $1.800 + $5.000 = $23.000
    await expect(page.getByTestId("quote-total")).toHaveText("$ 23.000");

    await page.getByRole("button", { name: "Guardar presupuesto" }).click();

    await expect(page).toHaveURL(/\/presupuestos$/);
    await expect(page.getByText("$ 23.000").first()).toBeVisible();
    await expect(page.getByText("Flete")).toBeVisible();
  });

  test("el descuento negociado baja el total", async ({ page }) => {
    await page.goto("/presupuestos/nuevo");

    await page.getByLabel("Producto del catálogo").first().selectOption({ label: "Alfajor triple" });
    await page.getByLabel("Cantidad").first().fill("10");
    await page.getByLabel("Descuento").fill("3000");

    await expect(page.getByTestId("quote-subtotal")).toHaveText("$ 18.000");
    await expect(page.getByTestId("quote-total")).toHaveText("$ 15.000");
  });

  test("el link público muestra el detalle sin iniciar sesión", async ({ page, context }) => {
    await page.goto("/presupuestos/nuevo");
    await page.getByLabel("Producto del catálogo").first().selectOption({ label: "Chicles" });
    await page.getByLabel("Cantidad").first().fill("4");
    await page.getByLabel("¿Para quién es?").fill("Obra Belgrano");
    await page.getByRole("button", { name: "Guardar presupuesto" }).click();
    await expect(page).toHaveURL(/\/presupuestos$/);

    // El token sale del botón de compartir; lo leemos del href de WhatsApp.
    const whatsapp = page.getByRole("link", { name: "WhatsApp" }).first();
    const href = await whatsapp.getAttribute("href");
    const token = decodeURIComponent(href ?? "").match(/\/p\/([\w-]+)/)?.[1];
    expect(token).toBeTruthy();

    // Sesión limpia: el cliente no tiene cuenta.
    const anon = await context.browser()!.newContext();
    const anonPage = await anon.newPage();
    await anonPage.goto(`/p/${token}`);

    await expect(anonPage.getByRole("heading", { name: "Kiosco El Rulo" })).toBeVisible();
    await expect(anonPage.getByText("Obra Belgrano")).toBeVisible();
    await expect(anonPage.getByText("Chicles")).toBeVisible();
    await anon.close();
  });

  test("cobrar un presupuesto lo convierte en venta", async ({ page }) => {
    await page.goto("/presupuestos/nuevo");
    await page.getByLabel("Producto del catálogo").first().selectOption({ label: "Alfajor triple" });
    await page.getByLabel("Cantidad").first().fill("2");
    await page.getByRole("button", { name: "Guardar presupuesto" }).click();
    await expect(page).toHaveURL(/\/presupuestos$/);

    await page.getByRole("link", { name: "Cobrar" }).first().click();

    // El pedido llega cargado desde la cotización: no se vuelve a buscar nada.
    await expect(page.getByText("Alfajor triple").first()).toBeVisible();
    await elegirVendedor(page);
    await page.getByRole("button", { name: /Cobrar/ }).click();
    await page.getByRole("button", { name: "Efectivo", exact: true }).click();
    await page.getByRole("button", { name: /Confirmar/ }).click();

    await expect(page.getByText(/Venta registrada|Listo/).first()).toBeVisible({ timeout: 20_000 });

    // Y el presupuesto queda marcado, para no cotizar dos veces lo mismo.
    await page.goto("/presupuestos");
    await expect(page.getByText("Vendido").first()).toBeVisible();
  });
});
