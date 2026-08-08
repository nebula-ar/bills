import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const prepareOnly = process.argv.includes("--prepare-only");
const fast = process.argv.includes("--fast");
const playwrightTargets = process.argv.slice(2).filter((argument) => !["--prepare-only", "--fast", "--"].includes(argument));

function run(file, args, options = {}) {
  console.log(`> ${file} ${args.join(" ")}`);
  return execFileSync(file, args, { stdio: "inherit", ...options });
}

function output(file, args) {
  return execFileSync(file, args, { encoding: "utf8" });
}

function packageBin(packageName, binName = packageName) {
  const packagePath = require.resolve(`${packageName}/package.json`);
  const manifest = require(packagePath);
  const relative = typeof manifest.bin === "string" ? manifest.bin : manifest.bin[binName];
  return resolve(dirname(packagePath), relative);
}

function runBin(packageName, binName, args, options = {}) {
  return run(process.execPath, [packageBin(packageName, binName), ...args], options);
}

function outputBin(packageName, binName, args) {
  return output(process.execPath, [packageBin(packageName, binName), ...args]);
}

function parseStatus(raw) {
  const values = {};
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(?:"(.*)"|(.*))$/);
    if (match) values[match[1]] = match[2] ?? match[3];
  }
  return values;
}

// ─────────────────────────────────────────────────────────────────────────────
// Supabase Cloud (CI) vs Supabase local descartable (desarrollo).
//
// En CI el E2E apunta a Supabase Cloud (`jqosoazmavsfkebhtkyy.supabase.co`) con
// credenciales de QA: evita el `supabase start` de Docker y su dependencia del
// rate-limit de Docker Hub. El seed va scoped al tenant demo (ver prisma/seed.ts)
// para no tocar los datos de QA de esa base compartida.
//
// La detección es explícita: `E2E_CLOUD=1` prende el modo Cloud. Sin esa marca se
// mantiene el flujo local histórico (Docker descartable) para desarrollo.
// ─────────────────────────────────────────────────────────────────────────────
const cloud = process.env.E2E_CLOUD === "1";

// Construye una URL de Postgres para Supabase Cloud con sslmode=no-verify. El
// pg 8.22 que usa Bills trata `sslmode=require` como `verify-full`, y el cert
// de Supabase es auto-firmado: la conexión falla. `no-verify` encripta y no
// exige cadena de confianza, que es lo correcto para CI contra la nube.
function cloudPgUrl({ user, password, host, port, database, params }) {
  const url = new URL(`postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("sslmode", "no-verify");
  return url.toString();
}

function buildCloudEnv() {
  const missing = [
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "POSTGRES_DATABASE",
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ].filter((key) => !process.env[key]);
  if (missing.length > 0) throw new Error(`E2E Cloud requiere: ${missing.join(", ")}`);

  const password = process.env.POSTGRES_PASSWORD;
  const database = process.env.POSTGRES_DATABASE;
  const projectRef = process.env.SUPABASE_PROJECT_REF ?? "jqosoazmavsfkebhtkyy";

  // El pooler host y el usuario con prefijo de proyecto se derivan de la URL
  // no-pooling cuando está disponible (workspace/CI); si no, se arman desde las
  // variables sueltas.
  let poolerHost = "aws-0-us-east-1.pooler.supabase.com";
  let dbUser = `${process.env.POSTGRES_USER}.${projectRef}`;

  if (process.env.POSTGRES_URL_NON_POOLING) {
    try {
      const parsed = new URL(process.env.POSTGRES_URL_NON_POOLING);
      poolerHost = parsed.hostname;
      dbUser = decodeURIComponent(parsed.username);
    } catch {
      // Si la URL no parsea, seguimos con los defaults.
    }
  }

  // Supavisor: 5432 directo (para DDL y seed), 6543 transaction (para la app).
  const directUrl = cloudPgUrl({ user: dbUser, password, host: poolerHost, port: "5432", database, params: {} });
  const transactionUrl = cloudPgUrl({ user: dbUser, password, host: poolerHost, port: "6543", database, params: {} });

  return {
    ...process.env,
    APP_URL: "http://127.0.0.1:3100",
    DATABASE_URL: transactionUrl,
    DIRECT_URL: directUrl,
    SUPABASE_INTERNAL_URL: process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    EXPECTED_ENVIRONMENT_INSTANCE_ID: "00000000-0000-4000-8000-000000000001",
    STAFF_SESSION_SECRET: "e2e-staff-session-secret-at-least-32-characters",
    AUTH_RATE_LIMIT_SECRET: "e2e-auth-rate-limit-secret-at-least-32-characters",
    AUTH_REGISTER_IP_MAX_ATTEMPTS: "100",
    OPENROUTER_API_KEY: "e2e-key-not-real",
  };
}

if (!cloud) {
  runBin("supabase", "supabase", [
    "start",
    "--exclude",
    "studio,realtime,storage,imgproxy,edge-runtime,functions,inbucket,analytics,vector",
  ]);
}

try {
  let env;
  if (cloud) {
    env = buildCloudEnv();
  } else {
    runBin("supabase", "supabase", ["db", "reset", "--local", "--no-seed"]);
    const status = parseStatus(outputBin("supabase", "supabase", ["status", "-o", "env"]));
    env = {
      ...process.env,
      APP_URL: "http://127.0.0.1:3100",
      DATABASE_URL: status.DB_URL,
      DIRECT_URL: status.DB_URL,
      NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
      SUPABASE_INTERNAL_URL: status.API_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
      EXPECTED_ENVIRONMENT_INSTANCE_ID: "00000000-0000-4000-8000-000000000001",
      STAFF_SESSION_SECRET: "e2e-staff-session-secret-at-least-32-characters",
      AUTH_RATE_LIMIT_SECRET: "e2e-auth-rate-limit-secret-at-least-32-characters",
      AUTH_REGISTER_IP_MAX_ATTEMPTS: "100",
      OPENROUTER_API_KEY: "e2e-key-not-real",
    };
  }

  for (const key of ["DATABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!env[key]) throw new Error(`No se resolvió ${key}`);
  }

  runBin("prisma", "prisma", ["generate"], { env, stdio: "inherit" });
  run(process.execPath, ["scripts/e2e-prepare.mjs"], { env, stdio: "inherit" });
  if (!prepareOnly) {
    if (!fast) runBin("next", "next", ["build"], { env, stdio: "inherit" });
    runBin("@playwright/test", "playwright", ["test", ...playwrightTargets], { env, stdio: "inherit" });
  }
} finally {
  if (!cloud && process.env.CI) {
    try {
      runBin("supabase", "supabase", ["stop", "--no-backup"]);
    } catch {
      // El runner efímero igual se destruye; no ocultamos el resultado de tests.
    }
  }
}
