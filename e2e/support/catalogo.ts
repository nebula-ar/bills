import { expect, type Locator, type Page } from "@playwright/test";

import { nombreDePrueba } from "./nombres";

/**
 * Los gestos de la pantalla de Productos, en un solo lugar.
 *
 * Los tests hablan de "dar de alta un producto", no de "clickear el tercer
 * botón y esperar 300ms". Cuando el alta cambie de tres pasos a cuatro, se
 * arregla acá y no en doce tests.
 */

/**
 * Un botón por su texto, quedándose con el que se VE.
 *
 * La app dibuja dos copias de varias piezas —el encabezado de Productos, el
 * formulario de login— una para mobile y otra para escritorio, y esconde la que
 * no corresponde con CSS. Sin filtrar por visible, Playwright encuentra dos y
 * corta por strict mode; peor sería que eligiera la escondida y esperara un
 * click que nunca puede pasar.
 */
export function boton(scope: Page | Locator, nombre: string | RegExp): Locator {
  return scope.getByRole("button", { name: nombre }).filter({ visible: true }).first();
}

/** Cualquier panel lateral abierto. No matchea diálogos de EJ2. */
export function panel(page: Page): Locator {
  return page.locator('[role="dialog"][aria-modal="true"]');
}

/**
 * La ficha de un producto, distinguida por su pie.
 *
 * Hace falta separarla del alta porque los dos son el mismo `SidePanel` con el
 * mismo rol y el mismo `aria-modal`, y durante los 440ms de la animación de
 * cierre CONVIVEN en el DOM: al tocar "Ver su ficha" el alta todavía se está
 * yendo mientras la ficha ya entró. Un selector que matchee a los dos falla por
 * strict mode justo ahí, de forma intermitente, que es la peor manera de
 * fallar.
 *
 * El corte es la pestaña "General": la ficha tiene la tira de pestañas y el
 * alta no.
 *
 * NO se usa "Guardar cambios", que era lo primero que probé: ese pie
 * desaparece en Rentabilidad e Historial —a propósito, porque ahí no hay nada
 * que guardar— así que el selector dejaba de encontrar la ficha justo después
 * de cambiar de pestaña. Identificar algo por una parte que se esconde sola es
 * pedirle al test que falle en la mitad del recorrido.
 */
export function fichaAbierta(page: Page): Locator {
  return panel(page).filter({ has: page.getByRole("button", { name: "General", exact: true }) });
}

/** El panel del alta: el que NO tiene pestañas. */
export function altaAbierta(page: Page): Locator {
  return panel(page).filter({ hasNot: page.getByRole("button", { name: "General", exact: true }) });
}

/**
 * La raíz de la grilla de Syncfusion.
 *
 * `.e-grid.e-catalog-grid` y no `.e-catalog-grid` a secas: EJ2 le pega la
 * `cssClass` que uno le pasa a TODOS sus contenedores internos —cabecera,
 * contenido, pie, paginador—, así que el selector corto matchea 5 elementos y
 * Playwright corta por strict mode. La raíz es la única que además es `.e-grid`.
 */
export function grilla(page: Page): Locator {
  return page.locator(".e-grid.e-catalog-grid");
}

/** Las filas. Cuelgan de la raíz para no multiplicarse por los 5 contenedores. */
export function filas(page: Page): Locator {
  return grilla(page).locator(".e-row");
}

/** La fila de totales, la que va arriba de las filas. */
export function totales(page: Page): Locator {
  return grilla(page).locator(".e-summaryrow").first();
}

/** La cabecera de columnas. */
export function cabecera(page: Page): Locator {
  return grilla(page).locator(".e-gridheader");
}

export async function irAProductos(page: Page): Promise<void> {
  await page.goto("/catalog");
  // La grilla de EJ2 monta después de la hidratación: esperar el <h1> no
  // alcanza, las filas todavía no existen y el primer click se pierde.
  await expect(page.getByRole("heading", { name: "Productos" })).toBeVisible();
  await expect(grilla(page)).toBeVisible({ timeout: 30_000 });
}

/**
 * Da de alta un producto por la pantalla, paso a paso, como lo haría el dueño.
 *
 * Avanza mientras haya un "Seguir" en vez de contar los pasos: cuántos son lo
 * decide el rubro (`newProductSteps`), así que un test que asuma tres se rompe
 * el día que una verdulería agrega el suyo.
 *
 * Devuelve el nombre generado, que ya viene con el prefijo `E2E-`.
 */
export async function altaManual(
  page: Page,
  opciones: { etiqueta: string; precio?: string; costo?: string } = { etiqueta: "producto" },
): Promise<string> {
  const nombre = nombreDePrueba(opciones.etiqueta);

  await boton(page, "Nuevo producto").click();
  await boton(page, /Cargarlo a mano/i).click();

  const hoja = altaAbierta(page);
  await expect(hoja).toBeVisible();
  await hoja.locator('input[name="name"]').fill(nombre);

  // Hasta 8 pasos por si el rubro suma alguno; el corte real es que aparezca
  // "Crear". El tope existe para que un bug de navegación falle en 8 vueltas y
  // no cuelgue el test hasta el timeout.
  for (let paso = 0; paso < 8; paso += 1) {
    const precio = hoja.locator('input[name="price"]');
    if (opciones.precio && (await precio.count()) > 0 && (await precio.isVisible())) {
      await precio.fill(opciones.precio);
    }

    const costo = hoja.locator('input[name="cost"]');
    if (opciones.costo && (await costo.count()) > 0 && (await costo.isVisible())) {
      await costo.fill(opciones.costo);
    }

    const crear = boton(hoja, /^Crear/i);
    if (await crear.isVisible().catch(() => false)) {
      await crear.click();
      break;
    }

    await boton(hoja, "Seguir").click();
  }

  // La confirmación es la señal de que el producto existe en la base.
  await expect(boton(hoja, "Cargar otro")).toBeVisible({ timeout: 30_000 });
  await esperarPanelQuieto(hoja);
  return nombre;
}

/** Busca en la grilla y espera a que el filtro haya corrido (hay 200ms de debounce). */
export async function buscar(page: Page, texto: string): Promise<void> {
  const buscador = page.getByPlaceholder(/^Buscar /i);
  await buscador.fill(texto);
  await page.waitForTimeout(400);
}

/**
 * Espera a que el panel termine de entrar.
 *
 * `toBeVisible()` se cumple apenas el nodo está en el DOM, y el panel tarda
 * 440ms en deslizarse. Medir la caja en el medio del viaje devuelve una
 * posición intermedia: el test de mobile pedía `y === 0` y recibía 300 y pico,
 * que no es un bug de la pantalla sino una foto sacada temprano.
 */
export async function esperarPanelQuieto(objetivo: Locator): Promise<void> {
  let anterior = "";
  for (let intento = 0; intento < 20; intento += 1) {
    const caja = await objetivo.boundingBox();
    const actual = JSON.stringify(caja);
    if (actual === anterior) return;
    anterior = actual;
    await objetivo.page().waitForTimeout(80);
  }
}

/** Abre la ficha de la primera fila visible. */
export async function abrirPrimeraFicha(page: Page): Promise<Locator> {
  // Se clickea la PRIMERA CELDA, no el centro de la fila. En escritorio la fila
  // ocupa todo el ancho y su centro cae sobre la columna de disponibilidad,
  // cuyo switch se come el click: la ficha no abría y el test se quedaba
  // esperando un panel que nadie pidió. La primera celda es la foto y el
  // nombre, que es por donde lo abre una persona.
  await filas(page).first().locator(".e-rowcell").first().click();
  const ficha = fichaAbierta(page);
  await expect(ficha).toBeVisible({ timeout: 15_000 });
  await esperarPanelQuieto(ficha);
  return ficha;
}

/**
 * Espera a que la grilla deje de moverse sola.
 *
 * Syncfusion termina de vincular datos de forma asincrónica —prende su spinner,
 * marca `aria-busy` y repinta las plantillas de cada celda— bastante después de
 * que la red quedó quieta. Medir ahí adentro le echa la culpa al tipeo de algo
 * que arrancó con el filtro anterior.
 *
 * Se considera quieta cuando pasa `calma` sin una sola mutación.
 */
export async function esperarGrillaQuieta(page: Page, calma = 700): Promise<void> {
  await page.evaluate((ms) => {
    const raiz = document.querySelector(".e-grid.e-catalog-grid");
    if (!raiz) return Promise.resolve();

    return new Promise<void>((resolver) => {
      let temporizador = 0;
      const observador = new MutationObserver(() => {
        window.clearTimeout(temporizador);
        temporizador = window.setTimeout(terminar, ms);
      });
      function terminar() {
        observador.disconnect();
        resolver();
      }
      observador.observe(raiz, { childList: true, subtree: true, attributes: true });
      temporizador = window.setTimeout(terminar, ms);
    });
  }, calma);
}
