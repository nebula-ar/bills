// Genera las capturas que alimentan el video promocional (remotion/).
//
// Por qué un script y no capturas a mano: el video tiene que poder rehacerse
// cuando cambie la UI. Acá se corre de nuevo y las pantallas se actualizan
// solas; con capturas manuales, el promo envejece y nadie se entera.
//
// Usa la cuenta sembrada del README (Kiosco El Rulo), la misma que la suite
// e2e: datos curados y creíbles, sin un solo dato de cliente real.
//
//   node scripts/capturas-promo.mjs [http://localhost:3000]

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SALIDA = "public/promo";
const ADMIN = { email: "owner@bills.local", password: "admin123" };

// deviceScaleFactor 2 => 3840x2160 reales. El brief pide zooms lentos sobre la
// interfaz: con 1080p plano, al acercarse se pixela y se nota.
const VIEWPORT = { width: 1920, height: 1080 };

// `/pos` es sólo el selector de sucursales y queda medio vacío; la pantalla que
// muestra vender de verdad es `/sales/new`, la misma que usa la suite e2e.
const PANTALLAS = [
  { nombre: "01-inicio", url: "/entrar", espera: "Panel" },
  { nombre: "02-dashboard", url: "/dashboard", espera: "Ventas de hoy" },
  { nombre: "03-productos", url: "/catalog", espera: "Alfajor" },
  { nombre: "04-mostrador", url: "/sales/new", espera: null },
  { nombre: "05-historial", url: "/sales", espera: null },
];

// El indicador de desarrollo de Next (el círculo con la "N") no puede aparecer
// en un video promocional. Se oculta por CSS en vez de buildear a producción:
// una captura con overlay de dev arruina la toma y no se nota hasta el render.
const OCULTAR_OVERLAY_DEV = `
  nextjs-portal,
  [data-nextjs-dev-tools-button],
  [data-nextjs-toast],
  #__next-dev-tools-indicator { display: none !important; }
`;

async function main() {
  await mkdir(SALIDA, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    // La app respeta prefers-reduced-motion, así que las animaciones de entrada
    // quedan en su estado final: capturamos la pantalla quieta y no un frame a
    // mitad de un fade.
    reducedMotion: "reduce",
    locale: "es-AR",
  });
  const page = await context.newPage();

  await page.goto(`${BASE}/login`);
  await page.locator("#email").fill(ADMIN.email);
  await page.locator("#password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.getByRole("link", { name: /^Panel/ }).waitFor({ timeout: 30_000 });

  for (const pantalla of PANTALLAS) {
    await page.goto(`${BASE}${pantalla.url}`);
    if (pantalla.espera) {
      await page.getByText(pantalla.espera).first().waitFor({ timeout: 30_000 }).catch(() => {
        console.warn(`  ! no apareció "${pantalla.espera}", capturo igual`);
      });
    }
    await page.addStyleTag({ content: OCULTAR_OVERLAY_DEV });
    // Margen para que terminen de resolverse imágenes y números animados.
    await page.waitForTimeout(1200);
    const archivo = `${SALIDA}/${pantalla.nombre}.png`;
    await page.screenshot({ path: archivo, animations: "disabled" });
    console.log(`ok  ${archivo}  <-  ${pantalla.url}`);
  }

  // Toma extra: la venta ya armada, que es el corazón del video ("mostrar cómo
  // se registra una operación" y "destacar el total"). Se llena el carrito y se
  // corta ahí: NO se toca "Continuar al cobro", porque eso grabaría una venta
  // de verdad en la base.
  await page.goto(`${BASE}/sales/new`);
  await page.addStyleTag({ content: OCULTAR_OVERLAY_DEV });

  const vendedor = page.getByTestId("staff-option").first();
  await vendedor.waitFor({ timeout: 30_000 }).catch(() => {});
  if (await vendedor.isVisible().catch(() => false)) await vendedor.click();

  for (const producto of ["Alfajor triple", "Gaseosa 500 ml", "Cerveza lata"]) {
    const tarjeta = page.getByText(producto, { exact: true }).first();
    if (await tarjeta.isVisible().catch(() => false)) {
      await tarjeta.click();
      await page.waitForTimeout(350);
    } else {
      console.warn(`  ! no encontré "${producto}" para sumar al carrito`);
    }
  }

  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SALIDA}/06-venta.png`, animations: "disabled" });
  console.log(`ok  ${SALIDA}/06-venta.png  <-  /sales/new (carrito armado)`);

  await browser.close();
}

main().catch((error) => {
  console.error("falló la captura:", error.message);
  process.exit(1);
});
