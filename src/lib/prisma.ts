import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL es obligatoria; Bills ya no admite SQLite.");
  }

  // Log de diagnóstico SIN credenciales: solo host/puerto para confirmar contra
  // qué base se conecta la app en producción.
  try {
    const parsed = new URL(url);
    console.log(`[prisma] usando Postgres (${parsed.host}${parsed.pathname})`);
  } catch {
    console.log("[prisma] usando Postgres (URL no parseable)");
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString: normalizePgConnection(url) }) });
}

// La conexión local VPS -> Supavisor no usa TLS. Para endpoints remotos se
// conserva exactamente la política sslmode declarada por el operador.
function normalizePgConnection(connectionString: string): string {
  try {
    const parsed = new URL(connectionString);
    if (["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)) {
      parsed.searchParams.set("sslmode", "disable");
    }
    return parsed.toString();
  } catch {
    return connectionString;
  }
}

// Instanciación perezosa (Proxy) en vez de crear el cliente al cargar el módulo.
// Next.js recolecta datos de build para rutas que no tocan la DB importando este
// módulo de forma transitiva. Con
// el Proxy, el cliente real recién se crea la primera vez que alguien accede a
// una propiedad (p.ej. `prisma.user`), es decir, en un request real.
function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, client);

    // Prisma expone métodos y getters que dependen de recibir al cliente real
    // como `this`. Usar el Proxy como receiver hacía que adapter-pg reutilizara
    // incorrectamente una conexión bajo carga concurrente.
    return typeof value === "function" ? value.bind(client) : value;
  },
}) as PrismaClient;
