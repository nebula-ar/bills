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

  // Proveedores no tiene pantalla propia: una compra es plata que sale, así que
  // todo el circuito —alta, factura, pago— pasa por Gastos.
  test("proveedores: cargar una factura y pagarla la saca de lo que se debe", async ({ page }) => {
    const unique = Date.now();
    await page.goto("/expenses");

    // Proveedor propio del test: así no depende del estado que dejaron otros.
    await page.getByRole("button", { name: "Proveedores" }).click();
    const alta = page.locator("form", { hasText: "Nuevo proveedor" });
    await alta.locator('input[name="name"]').fill(`Proveedor E2E ${unique}`);
    await alta.getByRole("button", { name: "Crear proveedor" }).click();
    await expect(page.getByText(`Proveedor E2E ${unique}`)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Cerrar" }).last().click();

    // Factura de compra a ese proveedor por $10.000 (10 unidades a $1.000).
    await page.getByRole("button", { name: "Nuevo gasto" }).click();
    await page.getByRole("button", { name: "Cargar una factura de proveedor" }).click();
    const factura = page.locator("form", { hasText: "Cargar factura" });
    await factura.locator('select[name="supplierId"]').selectOption({ label: `Proveedor E2E ${unique}` });
    await factura.locator('input[name="number"]').fill(`0001-${unique}`);
    await factura.locator('input[name="itemDescription"]').first().fill("Mercadería E2E");
    await factura.locator('input[name="itemQuantity"]').first().fill("10");
    await factura.locator('input[name="itemUnitCost"]').first().fill("1000");
    await factura.getByRole("button", { name: "Cargar factura" }).click();

    // Queda en "A pagar" con lo que falta.
    await page.goto("/expenses");
    const deuda = page.getByRole("button", { name: `Factura de Proveedor E2E ${unique}` });
    await expect(deuda).toBeVisible({ timeout: 15_000 });

    // Se paga completa: sale de lo que se debe y entra a lo que salió este mes.
    await deuda.click();
    await page.getByRole("button", { name: "Registrar pago" }).click();

    await page.goto("/expenses");
    await expect(page.getByRole("button", { name: `Factura de Proveedor E2E ${unique}` })).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect(page.getByText(`Pago a Proveedor E2E ${unique}`)).toBeVisible();
  });

  // Anular una compra tiene que devolver la mercadería. Si no, queda stock
  // fantasma: valuado en el patrimonio y vendible en el POS.
  test("proveedores: anular una factura saca del stock lo que había metido", async ({ page }) => {
    const unique = Date.now();

    // Existencia conocida de partida.
    await page.goto("/stock");
    const ajuste = page.locator("form", { hasText: "Guardar ajuste" });
    await ajuste.locator('select[name="productId"]').selectOption({ label: "Chicles (un)" });
    await ajuste.locator('input[name="counted"]').fill("50");
    await ajuste.getByRole("button", { name: "Guardar ajuste" }).click();
    await expect(page.getByRole("row").filter({ hasText: "Chicles" }).getByText("50 un")).toBeVisible({
      timeout: 15_000,
    });

    // Factura que mete 20 Chicles.
    await page.goto("/expenses");
    await page.getByRole("button", { name: "Proveedores" }).click();
    const alta = page.locator("form", { hasText: "Nuevo proveedor" });
    await alta.locator('input[name="name"]').fill(`Anulable ${unique}`);
    await alta.getByRole("button", { name: "Crear proveedor" }).click();
    await expect(page.getByText(`Anulable ${unique}`)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Cerrar" }).last().click();

    await page.getByRole("button", { name: "Nuevo gasto" }).click();
    await page.getByRole("button", { name: "Cargar una factura de proveedor" }).click();
    const factura = page.locator("form", { hasText: "Cargar factura" });
    await factura.locator('select[name="supplierId"]').selectOption({ label: `Anulable ${unique}` });
    await factura.locator('select[name="branchId"]').selectOption({ label: "Sucursal Centro" });
    await factura.locator('select[name="itemProductId"]').first().selectOption({ label: "Chicles (un)" });
    await factura.locator('input[name="itemDescription"]').first().fill("Chicles");
    await factura.locator('input[name="itemQuantity"]').first().fill("20");
    await factura.locator('input[name="itemUnitCost"]').first().fill("500");
    await factura.getByRole("button", { name: "Cargar factura" }).click();

    // Entró: 50 + 20.
    await page.goto("/stock");
    await expect(page.getByRole("row").filter({ hasText: "Chicles" }).getByText("70 un")).toBeVisible({
      timeout: 15_000,
    });

    // Se anula y la mercadería tiene que volver a salir.
    await page.goto("/expenses");
    await page.getByRole("button", { name: `Factura de Anulable ${unique}` }).click();
    await page.getByRole("button", { name: "Anular" }).click();
    // `force`: el botón de confirmar vive dentro del bottom sheet, que sigue
    // animando, y el chequeo de estabilidad de Playwright agota los 4 segundos
    // que el propio botón se da para desarmarse solo.
    await page.getByRole("button", { name: "Sí, anularla" }).click({ force: true });

    await page.goto("/stock");
    await expect(page.getByRole("row").filter({ hasText: "Chicles" }).getByText("50 un")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("módulos: apagar uno lo saca de la navegación", async ({ page }) => {
    await page.goto("/settings");

    const fila = page.locator("li", { hasText: "Descuentos, 2x1 y combos" });
    await fila.getByRole("button", { name: "Apagar" }).click();

    // Ya no se puede entrar por URL: requireModule manda a "/", que con sesión
    // es el desvío entre panel y mostrador.
    await page.goto("/promotions");
    await expect(page).toHaveURL("/entrar");

    // Lo dejamos como estaba para no ensuciar el resto de la suite. La prueba de
    // que volvió a estar prendido es que la pantalla vuelve a ser accesible.
    await page.goto("/settings");
    await page.locator("li", { hasText: "Descuentos, 2x1 y combos" }).getByRole("button", { name: "Prender" }).click();
    await page.goto("/promotions");
    await expect(page.getByRole("heading", { level: 1, name: "Promociones" })).toBeVisible();
  });
});
