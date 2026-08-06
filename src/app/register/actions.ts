"use server";

import { AuthProvisionKind, AuthRateLimitScope } from "@/generated/prisma/client";
import { assertEnvironmentIdentity } from "@/lib/environment-identity";
import { checkAuthRateLimits, registerFailedAuthAttempt } from "@/lib/login-rate-limit";
import { logError } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { provisionAuthIdentity } from "@/modules/auth/provision-auth-identity.use-case";
import { isEmailAvailable, registerBusiness, type RegisterBusinessInput } from "@/modules/auth/register-business.use-case";
import { headers } from "next/headers";

type RegisterActionResult = { ok: true; requiresLogin?: boolean } | { ok: false; error: string };

async function requestIp() {
  const store = await headers();
  return store.get("x-forwarded-for")?.split(",")[0]?.trim() || store.get("x-real-ip") || "unknown";
}

export async function registerBusinessAction(input: RegisterBusinessInput): Promise<RegisterActionResult> {
  try {
    await assertEnvironmentIdentity();
    const rateLimitKey = { scope: AuthRateLimitScope.REGISTER_IP, value: await requestIp() };
    const limit = await checkAuthRateLimits([rateLimitKey]);
    if (!limit.allowed) {
      return { ok: false, error: "Demasiados intentos de registro. Esperá un rato antes de volver a probar." };
    }
    await registerFailedAuthAttempt([rateLimitKey]);

    const result = await registerBusiness(input);
    if (!result.ok) return result;

    try {
      await provisionAuthIdentity({
        userId: result.userId,
        password: input.password,
        kind: AuthProvisionKind.REGISTRATION,
      });
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: result.emailCanonical,
        password: input.password,
      });
      return error ? { ok: true, requiresLogin: true } : { ok: true };
    } catch (error) {
      await logError("auth.registration-provision", error, { userId: result.userId });
      // El alta local queda durable para que soporte pueda conciliarla, pero el
      // login jamás permite reclamar una identidad pendiente sólo con el email.
      return {
        ok: false,
        error: "La cuenta quedó reservada, pero no pudimos habilitar el acceso. Contactá a soporte para terminar el alta.",
      };
    }
  } catch (error) {
    await logError("business.register", error, { context: { businessName: input?.businessName } });
    return { ok: false, error: "No pudimos crear la cuenta. Intentá de nuevo." };
  }
}

// Si falla el chequeo, devolvemos true (no bloqueamos): el submit revalida.
export async function checkEmailAvailableAction(email: string): Promise<boolean> {
  try {
    return await isEmailAvailable(email);
  } catch (error) {
    await logError("auth.email-check", error);
    return true;
  }
}
