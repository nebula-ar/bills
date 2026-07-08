// Config de Prisma para PRODUCCIÓN (Postgres / Supabase).
// Se usa con el flag --config, por ejemplo:
//   prisma migrate deploy --config prisma.postgres.config.ts
//   prisma generate       --config prisma.postgres.config.ts
//
// El schema se genera desde prisma/schema.prisma (ver scripts/build-postgres-schema.mjs).
// Para migraciones usamos DIRECT_URL (conexión directa, puerto 5432 en Supabase),
// no la pooled (6543), porque el pooler en modo transacción no soporta DDL.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/postgres/schema.prisma",
  migrations: {
    path: "prisma/postgres/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
