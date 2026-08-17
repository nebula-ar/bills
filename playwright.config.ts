import { defineConfig, devices } from "@playwright/test";
import { config as cargarEnv } from "dotenv";

// Playwright no lee los .env como hace Next. Va acá y no en un helper porque el
// config se carga en el proceso principal Y en cada worker: puesto en otro lado,
// las variables existirían en el global setup y no en los tests.
cargarEnv({ path: ".env", quiet: true });
cargarEnv({ path: ".env.local", override: true, quiet: true });

/**
 * E2E de la pantalla de Productos.
 *
 * Apunta SIEMPRE a localhost. `E2E_BASE_URL` existe para poder correrlo contra
 * un preview, pero el default no es la URL de producción a propósito: un
 * `npx playwright test` distraído no tiene que poder escribir en el server que
 * usa el negocio todos los días.
 *
 * Ojo igual: aunque el server sea local, la BASE es la de producción (ver
 * .env). Por eso todo lo que crean los tests lleva prefijo y se barre al
 * empezar y al terminar — la explicación completa está en e2e/support/entorno.ts.
 */
export default defineConfig({
  testDir: "./e2e",
  // En serie: comparten la misma base y el mismo negocio, así que dos specs
  // creando productos a la vez se pisan los totales de la grilla —que son una
  // suma de TODO lo que hay— y el fallo se lee como un bug de la pantalla.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : [["list"], ["html", { open: "never" }]],
  globalSetup: "./e2e/support/global-setup.ts",
  globalTeardown: "./e2e/support/global-teardown.ts",

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    // Se loguea una vez y guarda las cookies; el resto de los proyectos las
    // reusan. Sin esto, cada spec pagaría un login contra Supabase.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "escritorio",
      dependencies: ["setup"],
      // Sin esto, el proyecto de escritorio también levanta los specs de mobile
      // y los corre a 1280px: el test del panel de abajo hacia arriba fallaría
      // por estar probando la resolución equivocada.
      testIgnore: /.*\.mobile\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/estado.json" },
    },
    {
      name: "mobile",
      dependencies: ["setup"],
      testMatch: /.*\.mobile\.spec\.ts/,
      use: { ...devices["Pixel 7"], storageState: "e2e/.auth/estado.json" },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    // Si ya tenés el server levantado, lo usa en vez de arrancar otro y pelearse
    // por el puerto 3000.
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
