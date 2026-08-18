import { resolve } from "node:path";
import { config as cargarEnv } from "dotenv";
import { defineConfig } from "vitest/config";

/**
 * Config aparte, y a propósito.
 *
 * `npm test` corre `vitest.config.ts`, que solo toma `src/**\/*.test.ts`: lógica
 * pura, sin base. Estos tests SÍ escriben en Postgres, así que viven fuera de
 * ese glob y necesitan que alguien los pida por su nombre (`npm run
 * test:tenancy`).
 *
 * Mezclarlos habría hecho que cada `npm test` —y cada `vercel-build`, que corre
 * `vitest run` antes de compilar— escribiera en la base de producción. Eso no
 * es un test suite, es un incidente esperando.
 */

cargarEnv({ path: ".env.local", quiet: true });
cargarEnv({ path: ".env", quiet: true });

export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["e2e/tenancy/**/*.test.ts"],
    globalSetup: ["e2e/tenancy/global-setup.ts"],
    // La base es remota (pooler de Supabase) y estos tests hacen decenas de
    // idas y vueltas. El default de 5s no alcanza ni para el alta.
    testTimeout: 180_000,
    hookTimeout: 180_000,
    // Un archivo por vez: la concurrencia que se quiere medir es la de ADENTRO
    // del test (10 inquilinos escribiendo juntos), no la de vitest repartiendo
    // archivos. Si además paralelizara archivos, un fallo no diría cuál de las
    // dos concurrencias lo causó.
    fileParallelism: false,
  },
});
