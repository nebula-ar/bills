// Deriva el schema de Postgres (producción/Supabase) a partir del schema de
// SQLite (desarrollo local), que es la ÚNICA fuente de verdad de los modelos.
//
// Motivo: Prisma no permite `provider = env(...)`, así que para soportar dos
// motores (SQLite en local, Postgres en prod) generamos automáticamente el
// segundo schema en vez de mantener dos copias a mano (que se desincronizan).
//
// Uso: `node scripts/build-postgres-schema.mjs`
//   - lee  prisma/schema.prisma          (provider = "sqlite")
//   - escribe prisma/postgres/schema.prisma (provider = "postgresql")
//
// Se corre en el build de Vercel (ver package.json > vercel-build) antes de
// `prisma generate`/`migrate deploy`.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const source = resolve(root, "prisma/schema.prisma");
const target = resolve(root, "prisma/postgres/schema.prisma");

const original = readFileSync(source, "utf8");

// 1) provider del datasource: sqlite -> postgresql
let output = original.replace(
  /provider\s*=\s*"sqlite"/,
  'provider = "postgresql"',
);

if (output === original) {
  throw new Error(
    'No se encontró `provider = "sqlite"` en prisma/schema.prisma. ' +
      "Revisá que el schema base siga siendo el de SQLite.",
  );
}

// 2) output del generator: es relativo a la ubicación del schema. Al mover el
//    schema a prisma/postgres/ hay que subir un nivel más para apuntar al mismo
//    src/generated/prisma.
output = output.replace(
  /output\s*=\s*"\.\.\/src\/generated\/prisma"/,
  'output   = "../../src/generated/prisma"',
);

const banner =
  "// ARCHIVO GENERADO — no editar a mano.\n" +
  "// Fuente: prisma/schema.prisma (SQLite). Regenerar con:\n" +
  "//   node scripts/build-postgres-schema.mjs\n\n";

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, banner + output, "utf8");

console.log("Schema de Postgres generado en prisma/postgres/schema.prisma");
