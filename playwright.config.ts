import { defineConfig, devices } from "@playwright/test";

// E2E contra una base SQLite DESCARTABLE (e2e.db), nunca prod. La base se resetea
// y siembra en `npm run e2e:prepare` (antes de arrancar). El server (next dev en
// :3100) toma DATABASE_URL=file:./e2e.db vía el env de webServer.
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Serial: los tests comparten la misma base sembrada; evitamos choques entre workers.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 30_000,
  // Las pantallas se renderizan en el servidor y consultan varias tablas: el
  // primer render de cada ruta puede tardar más que el default.
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // El escáner pide la cámara: con un dispositivo falso, `getUserMedia`
    // resuelve sin diálogo de permiso y el lector se puede probar headless.
    permissions: ["camera"],
    launchOptions: {
      args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-capture"],
    },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  // Servimos la app en modo producción (next start). Evita el lock de "un solo
  // next dev por proyecto" y es más representativo/estable para CI. El build lo
  // corre el script `e2e` antes de lanzar playwright.
  webServer: {
    command: `npx next start --port ${PORT}`,
    url: `${BASE_URL}/login`,
    // `e2e:prepare` reemplaza e2e.db. Reusar un Next que ya tenía abierta la
    // SQLite anterior hace que la app lea un archivo huérfano y los tests vean
    // estado distinto del que acaba de sembrarse.
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: "file:./e2e.db",
      NEXTAUTH_SECRET: "e2e-secret-not-for-prod",
      NEXTAUTH_URL: BASE_URL,
      // Habilita la interfaz IA; las pruebas nunca llaman al proveedor pago.
      OPENROUTER_API_KEY: "e2e-key-not-real",
    },
  },
});
