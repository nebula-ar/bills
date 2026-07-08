import { createRequire } from "node:module";

import { PrismaClient } from "@/generated/prisma/client";

// Selección de driver adapter según el entorno (Prisma 7 exige driver adapter):
//   - DATABASE_URL "file:..."  -> SQLite (desarrollo local)
//   - cualquier otra URL       -> Postgres (producción / Supabase)
//
// Usamos createRequire (import dinámico) para NO cargar el paquete que no
// corresponde. Así el bundle de producción no arrastra better-sqlite3 (binario
// nativo que no corre en el runtime serverless de Vercel). Ambos paquetes están
// además en `serverExternalPackages` (next.config.ts) para no bundlearlos.
const require = createRequire(import.meta.url);

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";

  if (url.startsWith("file:")) {
    const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
    return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
  }

  const { PrismaPg } = require("@prisma/adapter-pg");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
