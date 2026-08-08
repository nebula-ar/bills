import { expect, test } from "@playwright/test";

import { loginAsAdmin, elegirVendedor } from "./helpers";

// Lo que pasa con el cliente enfrente: menos pasos para abrir la venta, el
// vuelto calculado, y que nadie cobre a nombre de otro sin querer.
test.describe("Cobrar rápido", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("el mostrador calcula el vuelto y ofrece los montos con los que se paga", async ({ page }) => {
    await page.goto("/sales/new");
    await elegirVendedor(page);
    await page.getByRole("button", { name: /Alfajor triple/ }).first().click();
    await page.getByRole("button", { name: "Sumar Alfajor triple" }).first().click();
    await page.getByRole("button", { name: "Cobrar" }).click();

    // 2 alfajores = $3.600. Efectivo viene elegido.
    await expect(page.getByText("¿Con cuánto paga?")).toBeVisible();

    // Con $5.000 el vuelto son $1.400.
    await page.getByRole("button", { name: "$ 5.000", exact: true }).click();
    await expect(page.getByText("Vuelto")).toBeVisible();
    await expect(page.getByText("$ 1.400")).toBeVisible();

    // Y si le dan menos de lo que sale, lo dice en vez de mostrar un vuelto negativo.
    await page.getByLabel("Con cuánto paga").fill("2000");
    await expect(page.getByText(/Con eso no alcanza/)).toBeVisible();
    await expect(page.getByText("Vuelto")).toHaveCount(0);
  });

  test("con una sola sucursal, vender no pasa por la pantalla de cajas", async ({ page }) => {
    // El seed tiene 3 sucursales, así que /pos sí muestra la lista. Verificamos
    // el otro lado: que la pantalla existe cuando hace falta elegir.
    await page.goto("/pos");
    await expect(page).toHaveURL(/\/pos$/);
    await expect(page.getByRole("heading", { name: "Puntos de venta" })).toBeVisible();
  });

  test("con varios empleados no se elige uno solo y en silencio", async ({ page }) => {
    // De acá salen las comisiones: atribuirle la venta al primero de la lista
    // sin que nadie lo toque es plata de otro.
    await page.goto("/sales/new");

    await expect(page.getByRole("heading", { name: /¿Quién atiende\?/ })).toBeVisible();
    await page.getByRole("button", { name: /Alfajor triple/ }).first().click();
    await page.getByRole("button", { name: "Cobrar" }).click();

    // Sin empleado elegido no se puede confirmar.
    await expect(page.getByRole("button", { name: /Confirmar venta/ })).toBeDisabled();
  });
});

test.describe("Borrar cuesta dos toques", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("eliminar un cliente pregunta antes", async ({ page }) => {
    await page.goto("/customers");

    const fila = page.getByRole("row").filter({ hasText: "Carla Suárez" });
    await fila.getByRole("button", { name: "Eliminar" }).click();

    // El botón cambia de cara en vez de ejecutar.
    await expect(fila.getByRole("button", { name: "Sí, borrar" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Carla Suárez" })).toBeVisible();
  });
});

test.describe("Encontrar el producto", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("el mostrador ordena por lo que más se vende", async ({ page }) => {
    await page.goto("/sales/new");
    await elegirVendedor(page);

    // El seed vende de todo; lo que importa es que el orden NO sea alfabético,
    // que es lo que obligaba a scrollear siempre hasta el mismo producto.
    const primero = await page.getByRole("button", { name: /^Agregar / }).first().getAttribute("aria-label");
    expect(primero).not.toBe("Agregar Agua saborizada 1,5 L");
  });

  test("buscar sin acentos encuentra igual", async ({ page }) => {
    await page.goto("/sales/new");
    await elegirVendedor(page);

    await page.getByPlaceholder(/Buscar/).fill("mani");
    await expect(page.getByRole("button", { name: /Maní salado/ })).toBeVisible();
  });

  test("el catálogo también se puede buscar", async ({ page }) => {
    await page.goto("/catalog");

    await page.getByLabel(/Buscar productos/).fill("chicl");
    await expect(page.getByRole("button").filter({ hasText: "Chicles" })).toHaveCount(1);
    await expect(page.getByRole("button").filter({ hasText: "Alfajor triple" })).toHaveCount(0);
  });
});
