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

runBin("supabase", "supabase", [
  "start",
  "--exclude",
  "studio,realtime,storage,imgproxy,edge-runtime,functions,inbucket,analytics,vector",
]);

try {
  runBin("supabase", "supabase", ["db", "reset", "--local", "--no-seed"]);
  const status = parseStatus(outputBin("supabase", "supabase", ["status", "-o", "env"]));
  const env = {
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

  for (const key of ["DATABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!env[key]) throw new Error(`supabase status no devolvió ${key}`);
  }

  runBin("prisma", "prisma", ["generate"], { env, stdio: "inherit" });
  run(process.execPath, ["scripts/e2e-prepare.mjs"], { env, stdio: "inherit" });
  if (!prepareOnly) {
    if (!fast) runBin("next", "next", ["build"], { env, stdio: "inherit" });
    runBin("@playwright/test", "playwright", ["test", ...playwrightTargets], { env, stdio: "inherit" });
  }
} finally {
  if (process.env.CI) {
    try {
      runBin("supabase", "supabase", ["stop", "--no-backup"]);
    } catch {
      // El runner efímero igual se destruye; no ocultamos el resultado de tests.
    }
  }
}
