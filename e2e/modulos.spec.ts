import { expect, test } from "@playwright/test";

import { loginAsAdmin, elegirVendedor } from "./helpers";

// Los módulos nuevos del sistema multi-rubro, cada uno probado en su flujo real
// (no solo que la pantalla cargue). El seed es un kiosco con todo prendido.
test.describe("Módulos del sistema", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("stock: un ajuste por conteo cambia la existencia", async ({ page }) => {
    await page.goto("/stock");

    // El ajuste se hace por nombre de producto y cantidad contada.
    const form = page.locator("form", { hasText: "Guardar ajuste" });
    await form.locator('select[name="productId"]').selectOption({ label: "Alfajor triple (un)" });
    await form.locator('input[name="counted"]').fill("42");
    await form.getByRole("button", { name: "Guardar ajuste" }).click();

    // Lo que importa es el dato: la fila muestra la existencia contada.
    await expect(page.getByRole("row").filter({ hasText: "Alfajor triple" }).getByText("42 un")).toBeVisible();
  });

  test("stock: una merma descuenta de la existencia", async ({ page }) => {
    await page.goto("/stock");

    // Fijamos una existencia conocida para que el test no dependa de las ventas
    // que hayan corrido antes.
    const ajuste = page.locator("form", { hasText: "Guardar ajuste" });
    await ajuste.locator('select[name="productId"]').selectOption({ label: "Chicles (un)" });
    await ajuste.locator('input[name="counted"]').fill("100");
    await ajuste.getByRole("button", { name: "Guardar ajuste" }).click();
    await expect(page.getByRole("row").filter({ hasText: "Chicles" }).getByText("100 un")).toBeVisible();

    const merma = page.locator("form", { hasText: "Registrar merma" });
    await merma.locator('select[name="productId"]').selectOption({ label: "Chicles (un)" });
    await merma.locator('input[name="quantity"]').fill("3");
    await merma.locator('input[name="reason"]').fill("Se cayeron al piso");
    await merma.getByRole("button", { name: "Registrar merma" }).click();

    await expect(page.getByRole("row").filter({ hasText: "Chicles" }).getByText("97 un")).toBeVisible();
  });

  test("promociones: el 3x2 del seed se aplica solo en el checkout", async ({ page }) => {
    await page.goto("/sales/new");
    await elegirVendedor(page);

    // Tres golosinas iguales disparan la promo por categoría.
    const agregar = page.getByRole("button", { name: "Agregar Alfajor triple" }).first();
    await agregar.click();
    await page.getByRole("button", { name: "Sumar Alfajor triple" }).first().click();
    await page.getByRole("button", { name: "Sumar Alfajor triple" }).first().click();

    // El total ya llega descontado desde el servidor (misma lógica que al cobrar).
    await expect(page.getByText("3x2 en golosinas").first()).toBeVisible({ timeout: 10_000 });
  });

  test("clientes: se puede fiar en el POS y después cobrar la cuenta", async ({ page }) => {
    await page.goto("/sales/new");
    await elegirVendedor(page);
    await page.getByRole("button", { name: "Agregar Alfajor triple" }).first().click();
    await page.getByRole("button", { name: "Cobrar" }).click();

    // Elegimos cliente y cobramos en cuenta corriente (fiado). Leemos a quién
    // elegimos en vez de suponer el orden de la lista: otros tests le agregan
    // deuda a los clientes y eso les cambia la etiqueta.
    const selector = page.getByLabel("Cliente");
    await selector.selectOption({ index: 1 });
    const elegido = ((await selector.locator("option").nth(1).textContent()) ?? "").split("—")[0].trim();

    await page.getByRole("button", { name: "Cuenta corriente" }).click();
    await page.getByRole("button", { name: /Confirmar venta/ }).click();
    await expect(page.getByText("¡Venta registrada!")).toBeVisible();

    // La deuda aparece en la ficha del cliente y se puede cobrar.
    await page.goto("/customers");
    await page.getByRole("link", { name: elegido }).click();
    await expect(page.getByText(/Debe /).first()).toBeVisible();

    const pago = page.locator("form", { hasText: "Registrar pago" });
    await pago.locator('input[name="amount"]').fill("1800");
    await pago.getByRole("button", { name: "Registrar pago" }).click();

    // Recargamos para leer el estado ya persistido, sin depender de cuándo el
    // router aplica la respuesta de la acción.
    await page.reload();
    await expect(page.getByRole("listitem").filter({ hasText: "Pago" }).first()).toBeVisible({ timeout: 15_000 });
  });

  test("proveedores: cargar una factura y pagarla la deja saldada", async ({ page }) => {
    const unique = Date.now();
    await page.goto("/suppliers");

    // Proveedor propio del test: así no depende del estado que dejaron otros.
    const alta = page.locator("form", { hasText: "Crear proveedor" });
    await alta.locator('input[name="name"]').fill(`Proveedor E2E ${unique}`);
    await alta.getByRole("button", { name: "Crear proveedor" }).click();
    // Recargamos para leer la lista ya persistida, sin depender de cuándo el
    // router termina de aplicar la respuesta de la acción.
    await page.goto("/suppliers");
    await expect(page.getByRole("row").filter({ hasText: `Proveedor E2E ${unique}` })).toBeVisible();

    // Factura de compra a ese proveedor por $10.000 (10 unidades a $1.000).
    const factura = page.locator("form", { hasText: "Cargar factura" });
    await factura.locator('select[name="supplierId"]').selectOption({ label: `Proveedor E2E ${unique}` });
    await factura.locator('input[name="number"]').fill(`0001-${unique}`);
    await factura.locator('input[name="itemDescription"]').first().fill("Mercadería E2E");
    await factura.locator('input[name="itemQuantity"]').first().fill("10");
    await factura.locator('input[name="itemUnitCost"]').first().fill("1000");
    await factura.getByRole("button", { name: "Cargar factura" }).click();
    await page.goto("/suppliers");

    const fila = page.getByRole("row").filter({ hasText: `Proveedor E2E ${unique}` });
    await expect(fila.getByText("Pendiente")).toBeVisible();

    // Se paga completa: queda saldada y sin saldo pendiente.
    await fila.getByRole("button", { name: "Pagar" }).click();
    await page.goto("/suppliers");
    await expect(
      page.getByRole("row").filter({ hasText: `Proveedor E2E ${unique}` }).getByText("Pagada"),
    ).toBeVisible();
  });

  test("módulos: apagar uno lo saca de la navegación", async ({ page }) => {
    await page.goto("/settings");

    const fila = page.locator("li", { hasText: "Descuentos, 2x1 y combos" });
    await fila.getByRole("button", { name: "Apagar" }).click();

    // Ya no se puede entrar por URL.
    await page.goto("/promotions");
    await expect(page).toHaveURL("/dashboard");

    // Lo dejamos como estaba para no ensuciar el resto de la suite. La prueba de
    // que volvió a estar prendido es que la pantalla vuelve a ser accesible.
    await page.goto("/settings");
    await page.locator("li", { hasText: "Descuentos, 2x1 y combos" }).getByRole("button", { name: "Prender" }).click();
    await page.goto("/promotions");
    await expect(page.getByRole("heading", { level: 1, name: "Promociones" })).toBeVisible();
  });
});
