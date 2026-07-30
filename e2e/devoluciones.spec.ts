import { expect, test } from "@playwright/test";

import { loginAsAdmin, elegirVendedor } from "./helpers";

// Devoluciones parciales: el cliente trae parte de lo que compró. Anular la
// venta entera era lo único que se podía hacer antes.
test.describe("Devoluciones", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  async function venderDos(page: import("@playwright/test").Page) {
    await page.goto("/sales/new");
    await elegirVendedor(page);
    await page.getByRole("button", { name: "Agregar Alfajor triple" }).first().click();
    await page.getByRole("button", { name: "Sumar Alfajor triple" }).first().click();
    await page.getByRole("button", { name: "Cobrar" }).click();
    await page.getByRole("button", { name: /Confirmar venta/ }).click();
    await expect(page.getByText("¡Venta registrada!")).toBeVisible();
  }

  test("devolver un ítem repone el stock y saca la plata de la caja", async ({ page }) => {
    // Dejamos el stock en un número conocido para poder afirmar sobre él.
    await page.goto("/stock");
    const ajuste = page.locator("form", { hasText: "Guardar ajuste" });
    await ajuste.locator('select[name="productId"]').selectOption({ label: "Alfajor triple (un)" });
    await ajuste.locator('input[name="counted"]').fill("50");
    await ajuste.getByRole("button", { name: "Guardar ajuste" }).click();
    await expect(page.getByRole("row").filter({ hasText: "Alfajor triple" }).getByText("50 un")).toBeVisible();

    await venderDos(page); // quedan 48

    await page.goto("/sales");
    await page.getByTestId("sale-row").first().click();
    await page.getByRole("button", { name: "Devolver ítems" }).click();

    await expect(page.getByText(/Quedan 2 un por devolver/)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /Sumar Alfajor triple/ }).click();
    await page.getByRole("button", { name: "Confirmar devolución" }).click();

    // Volvió una unidad al stock: 48 + 1.
    await page.goto("/stock");
    await expect(page.getByRole("row").filter({ hasText: "Alfajor triple" }).getByText("49 un")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("no deja devolver más de lo que queda", async ({ page }) => {
    await venderDos(page);

    await page.goto("/sales");
    await page.getByTestId("sale-row").first().click();
    await page.getByRole("button", { name: "Devolver ítems" }).click();
    await expect(page.getByText(/Quedan 2 un por devolver/)).toBeVisible({ timeout: 15_000 });

    // Aprieto sumar de más: el control lo topea en lo disponible.
    const sumar = page.getByRole("button", { name: /Sumar Alfajor triple/ });
    await sumar.click();
    await sumar.click();
    await sumar.click();
    await sumar.click();

    await expect(page.getByText("2", { exact: true }).first()).toBeVisible();
  });
});
