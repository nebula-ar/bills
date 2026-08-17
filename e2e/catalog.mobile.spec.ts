import { expect, test } from "@playwright/test";

import { abrirPrimeraFicha, boton, fichaAbierta, irAProductos } from "./support/catalogo";

/**
 * Lo que solo se puede romper en un teléfono.
 *
 * Corre con el proyecto "mobile" del config (Pixel 7, 412px), que está debajo
 * del corte de 768px donde el panel cambia de forma.
 */

test.describe("Productos en mobile", () => {
  test("el panel sube desde abajo y ocupa toda la pantalla", async ({ page }) => {
    await irAProductos(page);
    await abrirPrimeraFicha(page);

    const caja = await fichaAbierta(page).boundingBox();
    const pantalla = page.viewportSize()!;

    // Ancho completo y alto completo: en 412px de ancho, un panel de 30rem
    // separado 12px de cada borde es la pantalla igual, pero con un marco
    // oscuro que no se puede tocar y las esquinas comiéndose contenido.
    expect(Math.round(caja!.width)).toBe(pantalla.width);
    expect(Math.round(caja!.height)).toBe(pantalla.height);
    expect(Math.round(caja!.y)).toBe(0);
  });

  test("se puede llegar a la pestaña Historial", async ({ page }) => {
    // Las cuatro pestañas miden más que el ancho del teléfono. Antes el
    // contenedor desbordaba con `overflow: visible`: Historial quedaba cortada
    // contra el borde y era inalcanzable.
    await irAProductos(page);
    const ficha = await abrirPrimeraFicha(page);

    const historial = boton(ficha, "Historial");
    await historial.scrollIntoViewIfNeeded();
    await historial.click();

    const caja = await historial.boundingBox();
    const pantalla = page.viewportSize()!;
    expect(caja!.x + caja!.width, "Historial quedó fuera de la pantalla").toBeLessThanOrEqual(pantalla.width + 1);
  });
});
