import { defineConfig, devices } from "@playwright/test";

// E2E contra Supabase + PostgreSQL 17 descartables levantados por la CLI.
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
  // Contra Supabase Cloud (CI) la latencia de red suma segundos a cada render y
  // query del POS; el default de 30s no alcanza. En local (Docker) sobra.
  timeout: 60_000,
  // Las pantallas se renderizan en el servidor y consultan varias tablas: el
  // primer render de cada ruta puede tardar más que el default.
  expect: { timeout: 30_000 },
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
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? "",
      DIRECT_URL: process.env.DIRECT_URL ?? "",
      APP_URL: BASE_URL,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_INTERNAL_URL: process.env.SUPABASE_INTERNAL_URL ?? "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      EXPECTED_ENVIRONMENT_INSTANCE_ID: process.env.EXPECTED_ENVIRONMENT_INSTANCE_ID ?? "",
      STAFF_SESSION_SECRET: process.env.STAFF_SESSION_SECRET ?? "",
      AUTH_RATE_LIMIT_SECRET: process.env.AUTH_RATE_LIMIT_SECRET ?? "",
      AUTH_REGISTER_IP_MAX_ATTEMPTS: process.env.AUTH_REGISTER_IP_MAX_ATTEMPTS ?? "6",
      // Habilita la interfaz IA; las pruebas nunca llaman al proveedor pago.
      OPENROUTER_API_KEY: "e2e-key-not-real",
    },
  },
});
