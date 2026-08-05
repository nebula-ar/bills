import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl?.startsWith("postgres")) {
  throw new Error("E2E requiere DATABASE_URL PostgreSQL efímera.");
}

const require = createRequire(import.meta.url);
const prismaPackage = require.resolve("prisma/package.json");
const prismaBin = resolve(dirname(prismaPackage), require(prismaPackage).bin.prisma);
function run(args) {
  console.log(`> prisma ${args.join(" ")}`);
  execFileSync(process.execPath, [prismaBin, ...args], { stdio: "inherit", env: process.env });
}

run(["migrate", "deploy"]);
run(["db", "seed"]);

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
const centro = await client.query('select id from "Branch" where name = $1', ["Sucursal Centro"]);
const nicoTerminal = await client.query('select id from "Terminal" where name = $1', ["Terminal Nico"]);
await client.end();

writeFileSync(
  "e2e/seed-ids.json",
  JSON.stringify(
    { centroBranchId: centro.rows[0]?.id ?? null, nicoTerminalId: nicoTerminal.rows[0]?.id ?? null },
    null,
    2,
  ),
);

console.log("PostgreSQL E2E migrado y sembrado. IDs -> e2e/seed-ids.json");
