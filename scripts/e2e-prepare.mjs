// Prepara la base DESCARTABLE para los E2E: la borra, aplica migraciones (SQLite)
// y la siembra con datos de demo. Se corre antes de `playwright test`.
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { rmSync, writeFileSync } from "node:fs";

const require = createRequire(import.meta.url);

const env = { ...process.env, DATABASE_URL: "file:./e2e.db" };

for (const file of ["e2e.db", "e2e.db-journal"]) {
  try {
    rmSync(file);
  } catch {
    // no existía, ok
  }
}

function run(command) {
  console.log(`> ${command}`);
  execSync(command, { stdio: "inherit", env });
}

run("prisma migrate deploy");
run("prisma db seed");

// Volcamos algunos IDs sembrados para que los tests del barbero (que entran por
// link con ?branch=) no tengan que adivinarlos.
const Database = require("better-sqlite3");
const db = new Database("e2e.db", { readonly: true });
const centro = db.prepare('select id from "Branch" where name = ?').get("Sucursal Centro");
const nicoTerminal = db.prepare('select id from "Terminal" where name = ?').get("Terminal Nico");
db.close();

writeFileSync(
  "e2e/seed-ids.json",
  JSON.stringify({ centroBranchId: centro?.id ?? null, nicoTerminalId: nicoTerminal?.id ?? null }, null, 2),
);

console.log("Base e2e.db lista (migrada + sembrada). IDs -> e2e/seed-ids.json");
