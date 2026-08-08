import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import pg from "pg";

// Conexión para DDL / lecturas estructurales. En local es la del Supabase
// descartable; en Cloud es la 5432 directa (el pooler 6543 de `DATABASE_URL`
// es para el runtime de la app y no es la conexión correcta para el seed).
const directUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!directUrl?.startsWith("postgres")) {
  throw new Error("E2E requiere DIRECT_URL PostgreSQL.");
}

const require = createRequire(import.meta.url);
const prismaPackage = require.resolve("prisma/package.json");
const prismaBin = resolve(dirname(prismaPackage), require(prismaPackage).bin.prisma);
const tsxManifest = require("tsx/package.json");
const tsxBin = resolve(dirname(require.resolve("tsx/package.json")), typeof tsxManifest.bin === "string" ? tsxManifest.bin : tsxManifest.bin.tsx);

function run(args, options = {}) {
  console.log(`> prisma ${args.join(" ")}`);
  execFileSync(process.execPath, [prismaBin, ...args], { stdio: "inherit", env: process.env, ...options });
}

run(["migrate", "deploy"]);

// El seed se corre con tsx directo (no `prisma db seed`) para que no dependa de
// que `tsx` esté en el PATH del runner (falla en Windows local). `prisma db seed`
// haría `tsx prisma/seed.ts`; acá lo hacemos explícito con el binario resuelto.
// El seed usa DATABASE_URL del entorno (pooler 6543 en Cloud); el borrado del
// tenant y las inserciones ya validan contra el pooler.
console.log("> tsx prisma/seed.ts");
execFileSync(process.execPath, [tsxBin, "prisma/seed.ts"], { stdio: "inherit", env: process.env });

const client = new pg.Client({ connectionString: directUrl });
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
