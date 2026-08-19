import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  altaAbierta,
  boton,
  buscar,
  esperarPanelQuieto,
  fichaAbierta,
  grilla,
  irAProductos,
} from "./support/catalogo";
import { nombreDePrueba } from "./support/nombres";

/**
 * Recorre el alta de un producto y de un insumo sacando una captura por paso.
 *
 * No es un test: no afirma nada sobre la pantalla. Es un recolector, pensado
 * para juntar el material que después se le pasa a alguien —o a una IA— para
 * revisar la UX. Por eso vive aparte de los specs y no corre en CI.
 *
 *   npx playwright test e2e/capturas-ux.spec.ts --project=escritorio
 *
 * Las capturas quedan numeradas en `capturas/ux/`, en el orden en que un dueño
 * las vería. El número va adelante para que el orden del recorrido sobreviva al
 * orden alfabético de la carpeta: sin él, "10-ficha" se lee antes que "2-paso".
 *
 * Escribe en la MISMA base que el resto de los e2e —que es la de producción,
 * ver e2e/support/entorno.ts— así que todo lo que crea lleva el prefijo `E2E-`
 * y lo barre el teardown. No agregues acá un nombre sin `nombreDePrueba`.
 */

const CARPETA = "capturas/ux";

let paso = 0;

/** Una captura numerada. El nombre describe QUÉ se está mirando, no dónde. */
async function capturar(objetivo: Page | Locator, nombre: string): Promise<void> {
  paso += 1;
  const numero = String(paso).padStart(2, "0");
  await objetivo.screenshot({ path: `${CARPETA}/${numero}-${nombre}.png` });
}

/** Deja que las animaciones terminen antes de la foto. */
async function quieto(page: Page): Promise<void> {
  await page.waitForTimeout(500);
}

/**
 * Abre el alta manual, haya o no selector previo.
 *
 * `NewProductChooser` solo aparece cuando el rubro usa códigos de barras: sin
 * ellos no hay nada que elegir y el botón lleva derecho al alta. Asumir el
 * selector rompe el recorrido en una panadería, que es justamente donde
 * estamos mirando la UX.
 */
async function abrirAltaManual(page: Page): Promise<void> {
  await boton(page, "Nuevo producto").click();
  await page.waitForTimeout(500);

  const aMano = boton(page, /Cargarlo a mano/i);
  if (await aMano.isVisible().catch(() => false)) {
    await capturar(page, "elegir-como-cargar");
    await aMano.click();
  }
}

test.describe("capturas del alta y la ficha", () => {
  // El recorrido entero es una sola historia: si se partiera en tests, cada uno
  // arrancaría de cero y habría que volver a crear el producto para cada foto.
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test("producto que se vende, de punta a punta", async ({ page }) => {
    await irAProductos(page);
    await quieto(page);
    await capturar(page, "lista-de-productos");
    await capturar(grilla(page), "grilla-columnas-y-totales");

    // ── El alta, paso por paso ──────────────────────────────────────────────
    await abrirAltaManual(page);
    const hoja = altaAbierta(page);
    await expect(hoja).toBeVisible();
    await esperarPanelQuieto(hoja);

    const nombre = nombreDePrueba("producto");
    await hoja.locator('input[name="name"]').fill(nombre);
    await capturar(hoja, "alta-paso-nombre");

    // Avanza mientras haya "Seguir": cuántos pasos son lo decide el rubro, así
    // que contar tres rompería el recolector el día que se agregue uno.
    for (let vuelta = 0; vuelta < 8; vuelta += 1) {
      const crear = boton(hoja, /^Crear/i);
      if (await crear.isVisible().catch(() => false)) {
        await capturar(hoja, "alta-ultimo-paso-antes-de-crear");
        await crear.click();
        break;
      }

      await boton(hoja, "Seguir").click();
      await quieto(page);

      const precio = hoja.locator('input[name="price"]');
      if ((await precio.count()) > 0 && (await precio.isVisible())) {
        await precio.fill("2500");
      }

      const stock = hoja.locator('input[name="stock"]');
      if ((await stock.count()) > 0 && (await stock.isVisible())) {
        await stock.fill("12");
      }

      const costo = hoja.locator('input[name="cost"]');
      if ((await costo.count()) > 0 && (await costo.isVisible())) {
        await costo.fill("1200");
      }

      await capturar(hoja, `alta-paso-${vuelta + 2}`);
    }

    await expect(boton(hoja, "Cargar otro")).toBeVisible({ timeout: 30_000 });
    await esperarPanelQuieto(hoja);
    await capturar(hoja, "alta-recien-creado");

    // ── La ficha, pestaña por pestaña ───────────────────────────────────────
    await boton(hoja, /Ver su ficha/i).click();
    const ficha = fichaAbierta(page);
    await expect(ficha).toBeVisible({ timeout: 30_000 });
    await esperarPanelQuieto(ficha);
    await capturar(ficha, "ficha-general");

    for (const pestana of ["Inventario", "Receta", "Rentabilidad", "Historial"]) {
      const tab = ficha.getByRole("button", { name: pestana, exact: true });
      // Receta solo existe con el módulo prendido: se saltea sin romper el
      // recorrido en un negocio que no lo usa.
      if (!(await tab.isVisible().catch(() => false))) continue;

      await tab.click();
      await quieto(page);
      await capturar(ficha, `ficha-${pestana.toLowerCase()}`);
    }

    // Las operaciones de stock, desplegadas: es donde se ajusta, se recibe, se
    // anota una merma y se manda a otra sucursal.
    const inventario = ficha.getByRole("button", { name: "Inventario", exact: true });
    if (await inventario.isVisible().catch(() => false)) {
      await inventario.click();
      await quieto(page);

      // El nombre del archivo va explícito y no derivado del botón: cortar por
      // la primera palabra dejaba "stock-se.png", que no le dice nada a quien
      // después mira la carpeta.
      const operaciones = [
        { boton: "Llegó mercadería", archivo: "stock-llego-mercaderia" },
        { boton: "Conté y hay otra cantidad", archivo: "stock-conteo" },
        { boton: "Se perdió o rompió", archivo: "stock-merma" },
        { boton: "Se lo mandé a otra sucursal", archivo: "stock-traspaso" },
      ];

      for (const operacion of operaciones) {
        const control = boton(ficha, new RegExp(operacion.boton, "i"));
        if (!(await control.isVisible().catch(() => false))) continue;

        await control.click();
        await quieto(page);
        await capturar(ficha, operacion.archivo);

        // Se vuelve por "Cancelar", no re-clickeando el mismo botón: al abrir
        // una operación el panel REEMPLAZA la lista de botones por el
        // formulario, así que el disparador ya no existe.
        await ficha.getByRole("button", { name: "Cancelar" }).first().click();
        await quieto(page);
      }
    }

    await boton(ficha, /^Cancelar$/i)
      .click()
      .catch(() => undefined);
    await quieto(page);
  });

  test("insumo: unidad, costo por bulto y receta", async ({ page }) => {
    await irAProductos(page);
    await quieto(page);

    await abrirAltaManual(page);

    const hoja = altaAbierta(page);
    await expect(hoja).toBeVisible();
    await esperarPanelQuieto(hoja);

    const insumo = nombreDePrueba("insumo");
    await hoja.locator('input[name="name"]').fill(insumo);

    // El alta de insumo solo aparece con Recetas prendido. Sin el botón no hay
    // recorrido que capturar, y decirlo es mejor que sacar fotos de otra cosa.
    const esInsumo = boton(hoja, /Es un insumo/i);
    if (!(await esInsumo.isVisible().catch(() => false))) {
      test.skip(true, "El negocio no tiene el módulo Recetas prendido.");
      return;
    }

    await esInsumo.click();
    await quieto(page);
    await capturar(hoja, "alta-insumo-que-es");

    for (let vuelta = 0; vuelta < 8; vuelta += 1) {
      const crear = boton(hoja, /^Crear/i);
      if (await crear.isVisible().catch(() => false)) {
        await capturar(hoja, "alta-insumo-antes-de-crear");
        await crear.click();
        break;
      }

      await boton(hoja, "Seguir").click();
      await quieto(page);

      const cantidad = hoja.locator('input[name="stock"]');
      if ((await cantidad.count()) > 0 && (await cantidad.isVisible())) {
        await cantidad.fill("25,5");
      }

      const pagado = hoja.locator('input[name="cost"]');
      if ((await pagado.count()) > 0 && (await pagado.isVisible())) {
        await pagado.fill("30000");
      }

      const trae = hoja.locator('input[name="bultoTrae"]');
      if ((await trae.count()) > 0 && (await trae.isVisible())) {
        await trae.fill("25");
      }

      await capturar(hoja, `alta-insumo-paso-${vuelta + 2}`);
    }

    await expect(boton(hoja, "Cargar otro")).toBeVisible({ timeout: 30_000 });
    await esperarPanelQuieto(hoja);
    await boton(hoja, /Ver su ficha/i).click();

    const ficha = fichaAbierta(page);
    await expect(ficha).toBeVisible({ timeout: 30_000 });
    await esperarPanelQuieto(ficha);
    await capturar(ficha, "ficha-insumo-general");

    const inventario = ficha.getByRole("button", { name: "Inventario", exact: true });
    if (await inventario.isVisible().catch(() => false)) {
      await inventario.click();
      await quieto(page);
      await capturar(ficha, "ficha-insumo-inventario");
    }

    await boton(ficha, /^Cancelar$/i)
      .click()
      .catch(() => undefined);
    await quieto(page);

    // La pestaña de insumos de la lista, que solo existe cuando hay alguno.
    await irAProductos(page);
    const pestanaInsumos = boton(page, /^Insumos/i);
    if (await pestanaInsumos.isVisible().catch(() => false)) {
      await pestanaInsumos.click();
      await quieto(page);
      await capturar(page, "lista-pestana-insumos");
    }
  });

  test("producción, movimientos y opciones", async ({ page }) => {
    await irAProductos(page);
    await quieto(page);

    const movimientos = boton(page, /^Movimientos$/i);
    if (await movimientos.isVisible().catch(() => false)) {
      await movimientos.click();
      await quieto(page);
      await capturar(page, "hoja-movimientos-de-la-sucursal");
      // Se vuelve recargando y no con Escape: el overlay de la hoja tarda en
      // irse y se come el click siguiente, que falla como "el botón no
      // responde" cuando en realidad hay algo encima.
      await irAProductos(page);
      await quieto(page);
    }

    const produccion = boton(page, /^Producción$/i);
    if (await produccion.isVisible().catch(() => false)) {
      await produccion.click();
      await quieto(page);
      await capturar(page, "hoja-produccion-vacia");
      await irAProductos(page);
      await quieto(page);
    }

    // Las opciones viven en la ficha del primer producto que haya.
    await buscar(page, "E2E-");
    const primera = grilla(page).locator(".e-row").first();
    if ((await primera.count()) === 0) return;

    await primera.click();
    const ficha = fichaAbierta(page);
    if (!(await ficha.isVisible().catch(() => false))) return;

    await esperarPanelQuieto(ficha);
    const nuevoGrupo = boton(ficha, /Nuevo grupo de opciones/i);
    if (await nuevoGrupo.isVisible().catch(() => false)) {
      await nuevoGrupo.click();
      await quieto(page);
      await capturar(ficha, "ficha-opciones-nuevo-grupo");
    }
  });
});
