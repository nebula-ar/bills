import { expect, test } from "@playwright/test";

import { loginAsAdmin, elegirVendedor } from "./helpers";

async function crearVenta(page: import("@playwright/test").Page) {
  await page.goto("/sales/new");
  await elegirVendedor(page);
  await page.getByRole("button", { name: /Alfajor triple/ }).first().click();
  await page.getByRole("button", { name: "Cobrar" }).click();

  // El cobro va por pasos y cuáles aparecen depende del negocio: "¿Dónde?" solo
  // si usa salón, "¿Con cuánto paga?" solo si es efectivo. En vez de codificar
  // una secuencia que se rompe al cambiar los módulos, avanzamos hasta que
  // aparece el botón de confirmar. El tope evita colgarse si algo bloquea.
  const confirmar = page.getByRole("button", { name: /Confirmar venta/ });
  for (let intento = 0; intento < 5 && !(await confirmar.isVisible()); intento++) {
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
  }

  await confirmar.click();
  await expect(page.getByText("¡Venta registrada!")).toBeVisible();
}

test.describe("Ventas (POS admin)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("crear una venta con pago simple", async ({ page }) => {
    await crearVenta(page);
  });

  test("cancelar una venta desde el historial", async ({ page }) => {
    await crearVenta(page); // garantiza una venta COMPLETADA reciente
    await page.goto("/sales");
    // En escritorio el historial es una tabla; las tarjetas son del celular.
    await page.getByTestId("sale-row-table").first().click();
    await page.getByRole("button", { name: "Cancelar venta" }).click();
    await page.getByRole("button", { name: "Confirmar cancelación" }).click();
    // El toast es transitorio: lo que prueba la anulación es que la venta quede
    // marcada como cancelada en el historial.
    await expect(page.getByTestId("sale-row-table").first().getByText("Cancelada")).toBeVisible();
  });

  test("el historial filtra por período y totaliza lo que muestra", async ({ page }) => {
    await crearVenta(page);
    await page.goto("/sales");

    // La venta recién hecha entra en "Hoy", que es el período por defecto.
    await expect(page.getByTestId("sale-row-table").first()).toBeVisible();
    const facturadoHoy = await page.getByTestId("total-facturado").textContent();
    expect(facturadoHoy).not.toBe("$ 0");

    // Y NO entra en "Ayer": si el filtro no filtrara, este total sería el mismo.
    await page.getByRole("link", { name: "Ayer", exact: true }).click();
    await expect(page.getByTestId("total-facturado")).toHaveText("$ 0");
    await expect(page.getByTestId("sale-row-table")).toHaveCount(0);
  });
});
