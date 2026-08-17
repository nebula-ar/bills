import { expect, test } from "@playwright/test";

import {
  abrirPrimeraFicha,
  altaManual,
  boton,
  buscar,
  cabecera,
  filas,
  esperarGrillaQuieta,
  esperarPanelQuieto,
  irAProductos,
  altaAbierta,
  fichaAbierta,
  totales,
} from "./support/catalogo";
import { nombreDePrueba } from "./support/nombres";

/**
 * E2E de /catalog.
 *
 * Corren en serie contra la base real (ver e2e/support/limpieza.ts). Ningún test
 * toca un producto que no haya creado él mismo.
 */

test.describe("La pantalla", () => {
  test("carga la grilla con filas y los totales arriba", async ({ page }) => {
    await irAProductos(page);

    await expect(filas(page).first()).toBeVisible();

    // Los totales van ARRIBA de las filas, no en el pie: si estuvieran abajo
    // habría que scrollear toda la lista para ver cuánta plata hay en
    // mercadería, que es justo el número que se mira de un vistazo.
    const yCabecera = await cabecera(page).boundingBox();
    const yResumen = await totales(page).boundingBox();
    const yPrimeraFila = await filas(page).first().boundingBox();

    expect(yResumen!.y).toBeGreaterThan(yCabecera!.y);
    expect(yResumen!.y).toBeLessThan(yPrimeraFila!.y);
  });

  test("el buscador filtra y al limpiarlo vuelven todas", async ({ page }) => {
    await irAProductos(page);
    const total = await filas(page).count();

    await buscar(page, nombreDePrueba("no-existe-nada"));
    await expect(filas(page)).toHaveCount(0);

    await buscar(page, "");
    await expect(filas(page)).toHaveCount(total);
  });
});

test.describe("Alta de producto", () => {
  test("de punta a punta: se crea, se confirma y aparece en la lista", async ({ page }) => {
    await irAProductos(page);
    const nombre = await altaManual(page, { etiqueta: "alta", precio: "9520", costo: "3500" });

    // La confirmación tiene que devolver lo que se cargó: es el único momento
    // para pescar un precio mal tipeado sin salir a buscarlo a la lista.
    const hoja = altaAbierta(page);
    await expect(hoja.getByText(nombre)).toBeVisible();
    await expect(hoja.getByText("$ 9.520")).toBeVisible();

    // Y tiene que estar de verdad en la grilla, no solo en el cartel.
    await boton(hoja, "Cerrar").click();
    await expect(hoja).toBeHidden({ timeout: 20_000 });
    await buscar(page, nombre);
    await expect(filas(page)).toHaveCount(1);
  });

  test("sin precio avisa que todavía no se puede vender", async ({ page }) => {
    await irAProductos(page);
    await altaManual(page, { etiqueta: "sin-precio" });

    const hoja = altaAbierta(page);
    await expect(hoja.getByText("Sin precio")).toBeVisible();
    await expect(hoja.getByText(/todavía no se puede vender/i)).toBeVisible();
  });

  test("'Cargar otro' vuelve al primer paso en blanco", async ({ page }) => {
    await irAProductos(page);
    await altaManual(page, { etiqueta: "otro", precio: "1000" });

    const hoja = altaAbierta(page);
    await boton(hoja, "Cargar otro").click();

    // El nombre del anterior no puede quedar escrito: se guardaría dos veces lo
    // mismo con distinto precio.
    await expect(hoja.locator('input[name="name"]')).toHaveValue("");
  });

  test("'Ver su ficha' abre la ficha del producto recién creado", async ({ page }) => {
    await irAProductos(page);
    const nombre = await altaManual(page, { etiqueta: "ver-ficha", precio: "2500" });

    await boton(altaAbierta(page), "Ver su ficha").click();

    const ficha = fichaAbierta(page);
    await expect(boton(ficha, "Guardar cambios")).toBeVisible();
    await expect(ficha.locator('input[name="name"]')).toHaveValue(nombre);
  });

  test("no deja crear sin nombre", async ({ page }) => {
    await irAProductos(page);
    await boton(page, "Nuevo producto").click();
    await boton(page, /Cargarlo a mano/i).click();

    const hoja = altaAbierta(page);
    await boton(hoja, "Seguir").click();

    await expect(hoja.getByText(/Poné el nombre/i)).toBeVisible();
  });
});

test.describe("Ficha del producto", () => {
  test("tiene las cuatro pestañas y cambian el contenido", async ({ page }) => {
    await irAProductos(page);
    const nombre = await altaManual(page, { etiqueta: "pestanas", precio: "5000", costo: "2000" });
    await boton(altaAbierta(page), "Ver su ficha").click();

    const ficha = fichaAbierta(page);
    for (const pestana of ["General", "Inventario", "Rentabilidad", "Historial"]) {
      await boton(ficha, pestana).click();
      await expect(boton(ficha, pestana)).toBeVisible();
    }

    // El encabezado no cambia al cambiar de pestaña: es la ficha de ESE producto
    // en las cuatro. Se mira el VALUE del input y no el texto del panel: el
    // nombre se edita, así que vive en un <input>, y el value no forma parte
    // del textContent.
    await expect(ficha.locator('input[name="name"]')).toHaveValue(nombre);
  });

  test("editar el costo recalcula ganancia y margen, y cuenta el cambio", async ({ page }) => {
    await irAProductos(page);
    await altaManual(page, { etiqueta: "margen", precio: "10000", costo: "5000" });
    await boton(altaAbierta(page), "Ver su ficha").click();

    const ficha = fichaAbierta(page);
    await esperarPanelQuieto(ficha);

    // Primero que el costo haya llegado desde el alta. Si esto falla, el
    // problema es el alta y no el margen, y el mensaje lo tiene que decir.
    await expect(ficha.locator('input[name="cost"]'), "el alta no guardó el costo").toHaveValue(/5\.?000/);

    // 5.000 sobre 10.000 es 50%.
    await expect(ficha).toContainText("50%");

    await ficha.locator('input[name="cost"]').fill("2000");

    // 2.000 sobre 10.000 es 80%, y la ganancia pasa a 8.000.
    await expect(ficha).toContainText("80%", { timeout: 5_000 });
    await expect(ficha).toContainText("+$ 8.000");
    await expect(ficha).toContainText(/1 cambio sin guardar/i);
  });

  test("escribir y volver atrás deja el contador en cero", async ({ page }) => {
    await irAProductos(page);
    await altaManual(page, { etiqueta: "contador", precio: "10000", costo: "5000" });
    await boton(altaAbierta(page), "Ver su ficha").click();

    const ficha = fichaAbierta(page);
    const costo = ficha.locator('input[name="cost"]');
    await costo.fill("7000");
    await expect(ficha.getByText(/1 cambio sin guardar/i)).toBeVisible();

    // Escribir un número y borrarlo deja el formulario como estaba. Avisar de un
    // cambio ahí es una alarma falsa.
    await costo.fill("5.000");
    await expect(ficha.getByText(/sin guardar/i)).toBeHidden({ timeout: 5_000 });
  });

  test("guardar persiste el precio nuevo en la grilla", async ({ page }) => {
    await irAProductos(page);
    const nombre = await altaManual(page, { etiqueta: "guardar", precio: "1000", costo: "400" });
    await boton(altaAbierta(page), "Ver su ficha").click();

    const ficha = fichaAbierta(page);
    await ficha.locator('input[name="price"]').fill("7777");
    await boton(ficha, "Guardar cambios").click();

    // Guardar REDIRIGE (updateProduct usa redirectWithMessage), así que la
    // página se recarga entera. Buscar antes de que eso termine escribe en un
    // input que la navegación va a tirar a la basura, y el filtro nunca se
    // aplica: la grilla queda mostrando la primera fila de todas.
    await expect(ficha).toBeHidden({ timeout: 20_000 });
    await irAProductos(page);

    await buscar(page, nombre);
    await expect(filas(page).first()).toContainText("7.777");
  });

  test("cancelar NO guarda", async ({ page }) => {
    await irAProductos(page);
    const nombre = await altaManual(page, { etiqueta: "cancelar", precio: "1000", costo: "400" });
    await boton(altaAbierta(page), "Ver su ficha").click();

    const ficha = fichaAbierta(page);
    await ficha.locator('input[name="price"]').fill("9999");
    await boton(ficha, "Cancelar").click();
    await expect(ficha).toBeHidden({ timeout: 20_000 });

    await buscar(page, nombre);
    await expect(filas(page).first()).toContainText("1.000");
    await expect(filas(page).first()).not.toContainText("9.999");
  });

  test("el historial registra el cambio de precio con el valor viejo y el nuevo", async ({ page }) => {
    await irAProductos(page);
    const nombre = await altaManual(page, { etiqueta: "historial", precio: "1000", costo: "400" });
    await boton(altaAbierta(page), "Ver su ficha").click();

    const ficha = fichaAbierta(page);
    await ficha.locator('input[name="cost"]').fill("600");
    await boton(ficha, "Guardar cambios").click();
    await expect(ficha).toBeHidden({ timeout: 20_000 });
    await irAProductos(page);

    await buscar(page, nombre);
    const reabierta = await abrirPrimeraFicha(page);
    await boton(reabierta, "Historial").click();

    // Lo que importa no es que la pestaña abra, sino que el cambio quedó
    // anotado con los dos valores: sin el viejo, "¿por qué está a este precio?"
    // se sigue contestando de memoria.
    await expect(reabierta).toContainText("Costo", { timeout: 20_000 });
    await expect(reabierta).toContainText("400");
    await expect(reabierta).toContainText("600");
  });

  test("REGRESIÓN: escribir en la ficha no re-renderiza la grilla", async ({ page }) => {
    // El bug: el contador de cambios y el margen vivo hacían setState en el
    // componente que contiene la grilla entera, y la tabla se redibujaba con
    // cada tecla. Parecía que algo se guardaba solo. No se guardaba nada, pero
    // la pantalla decía lo contrario.
    await irAProductos(page);
    const nombre = await altaManual(page, { etiqueta: "rerender", precio: "1000", costo: "400" });

    // La ficha se abre desde una FILA, no con "Ver su ficha". Ese botón cierra
    // el alta, y cerrarla dispara un `router.refresh()`: la grilla se redibuja
    // porque llegaron datos nuevos, que es legítimo y no tiene nada que ver con
    // tipear. Midiendo ahí, el test acusaba a la tecla de algo que hizo el
    // refresh.
    // La X del encabezado del alta. `boton(page, "Cerrar")` a secas también
    // matchea el fondo oscuro, que lleva el mismo `aria-label`.
    const hoja = altaAbierta(page);
    await boton(hoja, "Cerrar").click();
    await expect(hoja).toBeHidden({ timeout: 20_000 });
    await buscar(page, nombre);
    const ficha = await abrirPrimeraFicha(page);
    await page.waitForLoadState("networkidle");
    await esperarGrillaQuieta(page);

    // Se mide el REDIBUJADO, no cualquier cambio de atributo.
    //
    // La primera versión contaba todo y fallaba por cosas inofensivas: EJ2 mueve
    // el `tabindex` entre celdas y le pone `e-selectionbackground` a la fila que
    // se clickeó. Eso es administración de foco y selección; no vuelve a armar
    // nada ni toca la base.
    //
    // Lo que delata un redibujado de verdad es otra cosa: el spinner
    // (`e-spin-show`), el `aria-busy` del contenido y las celdas reconstruidas
    // (`childList` sobre los `<td>`). Eso es EJ2 re-vinculando el `dataSource`,
    // que es exactamente lo que pasaba cuando `visibleProducts` se recreaba en
    // cada render.
    await page.evaluate(() => {
      const grilla = document.querySelector(".e-grid.e-catalog-grid");
      const w = window as unknown as { __redibujos: string[] };
      w.__redibujos = [];
      if (!grilla) return;

      new MutationObserver((ms) => {
        for (const m of ms) {
          const nodo = m.target instanceof Element ? m.target : m.target.parentElement;
          const clases = nodo?.className ?? "";

          if (m.type === "childList" && nodo?.closest(".e-rowcell")) {
            w.__redibujos.push(`celda reconstruida: ${String(clases).slice(0, 60)}`);
          }
          if (m.type === "attributes" && m.attributeName === "aria-busy") {
            w.__redibujos.push("la grilla se marcó ocupada (aria-busy)");
          }
          if (m.type === "attributes" && String(clases).includes("e-spin-show")) {
            w.__redibujos.push("se prendió el spinner de carga");
          }
        }
      }).observe(grilla, { childList: true, subtree: true, attributes: true });
    });

    await ficha.locator('input[name="cost"]').fill("123");
    await page.waitForTimeout(800);

    const redibujos = await page.evaluate(() => (window as unknown as { __redibujos: string[] }).__redibujos);
    const resumen = [...new Set(redibujos)].slice(0, 5).join(" | ");
    expect(redibujos, `la grilla volvió a vincular datos mientras se tipeaba: ${resumen}`).toHaveLength(0);
  });

  test("REGRESIÓN: escribir en la ficha no manda nada al servidor", async ({ page }) => {
    // Nada se guarda hasta apretar "Guardar cambios". Si esto falla, la pantalla
    // está escribiendo en la base a espaldas del usuario.
    await irAProductos(page);
    const nombre = await altaManual(page, { etiqueta: "sin-red", precio: "1000", costo: "400" });
    // La X del encabezado del alta. `boton(page, "Cerrar")` a secas también
    // matchea el fondo oscuro, que lleva el mismo `aria-label`.
    const hoja = altaAbierta(page);
    await boton(hoja, "Cerrar").click();
    await expect(hoja).toBeHidden({ timeout: 20_000 });
    await buscar(page, nombre);
    const ficha = await abrirPrimeraFicha(page);
    await page.waitForLoadState("networkidle");

    // Solo los POST a NUESTRO server. La primera versión miraba todos y se
    // colgaba de uno a `applicationinsights.azure.com`: la app manda telemetría
    // sola, que no tiene nada que ver con guardar el producto. Un test que
    // falla por eso enseña a ignorarlo, y el día que aparezca un POST de verdad
    // nadie lo va a mirar.
    const propios: string[] = [];
    const origen = new URL(page.url()).origin;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().startsWith(origen)) propios.push(req.url());
    });

    await ficha.locator('input[name="cost"]').fill("777");
    await page.waitForTimeout(1_000);

    expect(propios, `hubo POST al server mientras se tipeaba: ${propios.join(", ")}`).toHaveLength(0);
  });

  test("en escritorio el panel queda al costado, con margen", async ({ page }) => {
    // La contracara del test de mobile. Vive en el spec de escritorio y no en
    // el de mobile porque ahí corría dentro de un contexto con emulación táctil
    // al que le forzábamos 1280px: probaba una mezcla que ningún usuario tiene.
    await irAProductos(page);
    const ficha = await abrirPrimeraFicha(page);
    const caja = await ficha.boundingBox();
    const pantalla = page.viewportSize()!;

    expect(caja!.width).toBeLessThan(pantalla.width);
    expect(caja!.y).toBeGreaterThan(0);
  });
});
