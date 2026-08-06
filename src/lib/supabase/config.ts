import "server-only";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} es obligatoria.`);
  return value;
}

export function supabaseServerUrl(): string {
  return process.env.SUPABASE_INTERNAL_URL?.trim() || required("NEXT_PUBLIC_SUPABASE_URL");
}

export function supabaseAnonKey(): string {
  return required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export function supabaseServiceRoleKey(): string {
  return required("SUPABASE_SERVICE_ROLE_KEY");
}

export function expectedEnvironmentInstanceId(): string {
  return required("EXPECTED_ENVIRONMENT_INSTANCE_ID");
}

export function authRateLimitSecret(): string {
  const value = required("AUTH_RATE_LIMIT_SECRET");
  if (value.length < 32) throw new Error("AUTH_RATE_LIMIT_SECRET debe tener al menos 32 caracteres.");
  return value;
}

export function supabaseCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.APP_URL?.trim().toLowerCase().startsWith("https://") ?? false,
    path: "/",
  };
}
