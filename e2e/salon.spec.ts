import { expect, test, type Page } from "@playwright/test";

import { nombreDePrueba } from "./support/nombres";

/**
 * El salón de punta a punta, y su enganche con el navbar del mostrador.
 *
 * Todo se crea POR LA PANTALLA y no por SQL: un sector insertado a mano puede
 * quedar sin un campo que el caso de uso sí completa, y entonces el test pasa
 * sobre datos que la app nunca habría producido. Lo que se prueba es lo que
 * hace el usuario.
 *
 * Lo que crea lleva el prefijo E2E- y lo barre `support/limpieza.ts`, que borra
 * en orden —comandas, mesas, sectores— porque una mesa con pedido abierto no se
 * puede borrar y un sector con mesas tampoco.
 */

async function irAlSalon(page: Page): Promise<void> {
  await page.goto("/salon");
  await expect(page.getByRole("heading", { name: "Salón" })).toBeVisible({ timeout: 30_000 });
}

/**
 * El botón «+» flotante que abre el sheet "Agregar".
 *
 * Por su `aria-label` exacto y no por texto: el botón no tiene texto, es un
 * ícono, y buscarlo por /agregar|nuevo/ agarraba cualquier otra cosa de la
 * pantalla y se quedaba esperando un click que no abría nada.
 */
async function abrirAgregar(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Agregar mesa o sector" }).click();
  await expect(page.getByRole("heading", { name: "Agregar" })).toBeVisible({ timeout: 10_000 });
}

/** Crea un sector y espera a verlo en el tablero. */
async function crearSector(page: Page, nombre: string): Promise<void> {
  await abrirAgregar(page);
  await page.getByRole("button", { name: /Nuevo sector/ }).click();
  await page.locator('input[name="name"]:visible').fill(nombre);
  await page.getByRole("button", { name: "Crear sector" }).click();
  await expect(page.getByRole("heading", { name: nombre })).toBeVisible({ timeout: 20_000 });
}

/**
 * Crea una mesa EN EL SECTOR que se le pida, y espera a verla.
 *
 * Elegir el sector no es opcional aunque el formulario traiga uno puesto: el
 * default es el primero de la lista, que es un sector REAL del negocio. La
 * primera versión de este helper no lo tocaba y terminó creando las mesas de
 * prueba adentro del salón de verdad. Se limpiaron igual —van con prefijo— pero
 * el test verificaba el sector equivocado y por eso fallaba.
 *
 * El selector no es un `<select>` nativo sino un listbox propio con un input
 * oculto (ver ui/select-field.tsx), así que `selectOption` no sirve: hay que
 * abrirlo y tocar la opción.
 */
async function crearMesa(page: Page, nombre: string, sector: string): Promise<void> {
  await abrirAgregar(page);
  await page.getByRole("button", { name: /Nueva mesa/ }).click();

  await page.locator('[aria-haspopup="listbox"]:visible').first().click();
  await page.getByRole("option", { name: sector }).click();

  await page.locator('input[name="name"]:visible').fill(nombre);
  await page.getByRole("button", { name: "Crear mesa" }).click();
  await expect(page.getByText(nombre)).toBeVisible({ timeout: 20_000 });
}

test.describe("Salón", () => {
  test("crear un sector y sus mesas, y que aparezcan en el mostrador", async ({ page }) => {
    test.setTimeout(180_000);

    const sector = nombreDePrueba("sector");
    const mesas = [nombreDePrueba("m1"), nombreDePrueba("m2")];

    await irAlSalon(page);

    // ── El sector primero: sin sector no se puede crear una mesa (el botón
    //    "Mesa" del sheet llega deshabilitado). Es a propósito, para que las
    //    mesas no queden huérfanas.
    await crearSector(page, sector);

    // ── Las mesas, en ese sector.
    for (const mesa of mesas) await crearMesa(page, mesa, sector);

    // ── Y ahora lo que importa: que el mostrador las vea. Es el enganche que
    //    ningún test cubría; el navbar lee `mesasConComanda`, que es una query
    //    distinta de la que dibuja el salón.
    await page.goto("/sales/new");
    await expect(page.locator("main header")).toBeVisible({ timeout: 30_000 });

    await page.locator('[aria-haspopup="dialog"]').first().click();
    const panel = page.getByRole("dialog", { name: "¿Dónde va esta venta?" });
    await expect(panel).toBeVisible();

    for (const mesa of mesas) {
      await expect(panel.getByText(mesa)).toBeVisible();
    }

    // Recién creadas están libres, así que van bajo "Libres" y con su sector
    // como subtítulo: es lo que distingue dos mesas con el mismo número en
    // salones distintos.
    await expect(panel.getByText("Libres")).toBeVisible();
    await expect(panel.getByText(sector).first()).toBeVisible();
  });

  test("elegir una mesa en el navbar la deja marcada como destino", async ({ page }) => {
    test.setTimeout(180_000);

    const sector = nombreDePrueba("sector-destino");
    const mesa = nombreDePrueba("destino");

    await irAlSalon(page);
    await crearSector(page, sector);
    await crearMesa(page, mesa, sector);

    await page.goto("/sales/new");
    await expect(page.locator("main header")).toBeVisible({ timeout: 30_000 });

    const pastilla = page.locator('[aria-haspopup="dialog"]').first();
    await expect(pastilla).toContainText("Caja");

    await pastilla.click();
    await page.getByRole("dialog", { name: "¿Dónde va esta venta?" }).getByText(mesa).click();

    // La pastilla pasa a decir la mesa: es la confirmación de que la venta ya
    // no va al mostrador. Sin esto se cobra a caja creyendo que va a la mesa.
    await expect(pastilla).toContainText(mesa, { timeout: 10_000 });
  });
});
