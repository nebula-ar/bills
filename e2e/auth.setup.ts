import { expect, test as setup } from "@playwright/test";

const ESTADO = "e2e/.auth/estado.json";

/**
 * Se loguea una vez y guarda las cookies para todos los specs.
 *
 * Las credenciales se leen del entorno y NO están en el repo. Poné esto en tu
 * `.env.local` (que ya está ignorado por git):
 *
 *   E2E_EMAIL=vos@tunegocio.com
 *   E2E_PASSWORD=...
 *
 * Usá un usuario admin del negocio de prueba. Si tenés un solo negocio, es el
 * tuyo — y entonces vale la pena releer e2e/support/entorno.ts antes de correr
 * esto, porque los tests van a escribir en tu catálogo de verdad.
 */
setup("iniciar sesión", async ({ page }) => {
  // Más que el default de 30s: el login va contra Supabase por red, y en un día
  // lento se come casi todo el presupuesto antes de llegar a redirigir.
  setup.setTimeout(90_000);

  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  // Falla con un mensaje que dice qué hacer. Sin esto, el fallo aparecería
  // recién en el primer spec como "esperaba /catalog y estoy en /login", que no
  // le dice a nadie que falta una variable de entorno.
  expect(
    email && password,
    "Faltan E2E_EMAIL y E2E_PASSWORD en .env.local. Ver el comentario de e2e/auth.setup.ts.",
  ).toBeTruthy();

  await page.goto("/login");

  // `:visible` no es decoración. La pantalla de login dibuja el formulario DOS
  // veces —uno para mobile y otro para escritorio, con `idPrefix` distinto— y
  // esconde el que no corresponde con CSS. Sin el filtro, Playwright agarra el
  // primero del DOM, que a 1280px es el escondido, y se queda esperando 30
  // segundos a que un campo invisible se deje escribir.
  await page.locator('input[name="email"]:visible').fill(email!);
  await page.locator('input[name="password"]:visible').fill(password!);
  await page
    .getByRole("button", { name: /ingresar|iniciar|entrar/i })
    .filter({ visible: true })
    .first()
    .click();

  // La prueba de que el login anduvo es llegar a una pantalla con sesión, no
  // que el botón haya dejado de girar.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
  await page.context().storageState({ path: ESTADO });
});
