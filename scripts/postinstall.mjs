// Genera el Prisma Client correcto según el entorno, después de instalar deps.
//   - DATABASE_URL "file:..." (o ausente) -> cliente SQLite (dev local)
//   - cualquier otra URL                   -> cliente Postgres (prod / Supabase)
//
// Así un `npm install` en local deja el cliente SQLite listo, y en Vercel
// (donde DATABASE_URL apunta a Supabase) deja el cliente Postgres.

import { execSync } from "node:child_process";

const url = process.env.DATABASE_URL ?? "file:./dev.db";
const isSqlite = url.startsWith("file:");

function run(command) {
  console.log(`> ${command}`);
  execSync(command, { stdio: "inherit" });
}

if (isSqlite) {
  run("prisma generate");
} else {
  run("node scripts/build-postgres-schema.mjs");
  run("prisma generate --config prisma.postgres.config.ts");
}
