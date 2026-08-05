import pg from "pg";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} es obligatoria`);
  return value;
}

function assertEndpoint(name, expectedPort) {
  const parsed = new URL(required(name));
  if (!["127.0.0.1", "localhost", "::1"].includes(parsed.hostname) || parsed.port !== expectedPort) {
    throw new Error(`${name} debe apuntar a loopback:${expectedPort}`);
  }
  return parsed;
}

assertEndpoint("DATABASE_URL", "6543");
assertEndpoint("DIRECT_URL", "54322");
const internal = new URL(required("SUPABASE_INTERNAL_URL"));
if (!["127.0.0.1", "localhost", "::1"].includes(internal.hostname) || internal.port !== "8000") {
  throw new Error("SUPABASE_INTERNAL_URL debe apuntar a Kong por loopback:8000");
}

const expected = required("EXPECTED_ENVIRONMENT_INSTANCE_ID");
const appUrl = new URL(required("APP_URL"));
const publicSupabaseUrl = new URL(required("NEXT_PUBLIC_SUPABASE_URL"));
required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
required("SUPABASE_SERVICE_ROLE_KEY");
required("STAFF_SESSION_SECRET");
required("AUTH_RATE_LIMIT_SECRET");

const client = new pg.Client({ connectionString: process.env.DIRECT_URL });
await client.connect();
try {
  const result = await client.query(
    "select instance_id::text, environment from ops.environment_identity where singleton = true",
  );
  const actual = result.rows[0];
  if (!actual || actual.instance_id !== expected) throw new Error("ENVIRONMENT_IDENTITY_MISMATCH");
  if (actual.environment === "production" && (appUrl.protocol !== "https:" || publicSupabaseUrl.protocol !== "https:")) {
    throw new Error("Producción requiere APP_URL y NEXT_PUBLIC_SUPABASE_URL por HTTPS");
  }
  console.log(`Environment guard OK: ${actual.environment}:${actual.instance_id}`);
} finally {
  await client.end();
}
