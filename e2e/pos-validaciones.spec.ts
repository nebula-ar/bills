import { expect, test } from "@playwright/test";

import { loginAsAdmin, elegirVendedor } from "./helpers";

test.describe("POS: validaciones", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("pago dividido que no cubre el total deja el botón deshabilitado", async ({ page }) => {
    await page.goto("/sales/new");
    await elegirVendedor(page);
    await page.getByRole("button", { name: "Agregar Alfajor triple" }).first().click();
    await page.getByRole("button", { name: "Cobrar" }).click();

    // Activar pago dividido y vaciar el monto del único método.
    await page.getByRole("button", { name: "Dividir" }).click();
    await page.getByLabel("Monto del pago").fill("");

    // No cubre el total → no se puede confirmar.
    await expect(page.getByText(/Falta/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Confirmar venta/ })).toBeDisabled();
  });
});
