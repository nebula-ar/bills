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
  // En prod usamos DATABASE_URL; si no está, tomamos la que crea la integración
  // de Supabase en Vercel (POSTGRES_PRISMA_URL, pooled con pgbouncer). En local
  // cae al SQLite por defecto.
  const url =
    process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL ?? "file:./dev.db";

  if (url.startsWith("file:")) {
    console.log(`[prisma] usando SQLite (${url})`);
    const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
    return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
  }

  // Log de diagnóstico SIN credenciales: solo host/puerto para confirmar contra
  // qué base se conecta la app en producción.
  try {
    const parsed = new URL(url);
    console.log(`[prisma] usando Postgres (${parsed.host}${parsed.pathname})`);
  } catch {
    console.log("[prisma] usando Postgres (URL no parseable)");
  }

  const { PrismaPg } = require("@prisma/adapter-pg");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: forcePgSsl(url) }) });
}

// El pooler de Supabase presenta un certificado que las versiones nuevas de `pg`
// (que tratan `sslmode=require` como `verify-full`) rechazan con
// SELF_SIGNED_CERT_IN_CHAIN. Forzamos `sslmode=no-verify`: la conexión sigue
// cifrada por TLS pero sin validar la cadena de certificados. El pooler no es
// accesible sin TLS, así que esto no baja la seguridad de forma relevante.
function forcePgSsl(connectionString: string): string {
  try {
    const parsed = new URL(connectionString);
    parsed.searchParams.set("sslmode", "no-verify");
    return parsed.toString();
  } catch {
    return connectionString;
  }
}

// Instanciación perezosa (Proxy) en vez de crear el cliente al cargar el módulo.
// Next.js recolecta datos de build para rutas que no tocan la DB (p.ej.
// `/_not-found`) importando este módulo de forma transitiva; si esa recolección
// corre en un contexto sin DATABASE_URL todavía inyectada, `createPrismaClient`
// caía al fallback de SQLite mientras el cliente generado era el de Postgres, y
// tiraba PrismaClientInitializationError (adapter/provider incompatibles),
// rompiendo el build entero por una ruta que ni siquiera necesita Prisma. Con
// el Proxy, el cliente real recién se crea la primera vez que alguien accede a
// una propiedad (p.ej. `prisma.user`), es decir, en un request real.
function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getPrisma(), prop, receiver);
  },
}) as PrismaClient;
