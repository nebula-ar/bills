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
  expect: { timeout: 7_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
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
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL: "file:./e2e.db",
      NEXTAUTH_SECRET: "e2e-secret-not-for-prod",
      NEXTAUTH_URL: BASE_URL,
    },
  },
});
