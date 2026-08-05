import "server-only";

import { AuthRateLimitScope } from "@/generated/prisma/client";
import { LoginErrorCode, type LoginErrorCode as LoginErrorCodeType } from "@/lib/auth-errors";
import {
  checkAuthRateLimits,
  clearAuthAttempts,
  registerFailedAuthAttempt,
  type AuthRateLimitKey,
} from "@/lib/login-rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { findActiveAdminUserByIdentifier } from "./user.repository";

const INVALID_LOGIN_EMAIL = "invalid-login@bills.invalid";

export type LoginResult = { ok: true } | { ok: false; error: LoginErrorCodeType; retryAfterMs?: number };

export async function loginAdmin(input: { identifier: string; password: string; ip: string }): Promise<LoginResult> {
  const identifier = input.identifier.trim().toLowerCase();
  const password = input.password ?? "";
  const keys: AuthRateLimitKey[] = [
    { scope: AuthRateLimitScope.LOGIN_EMAIL, value: identifier || "empty" },
    { scope: AuthRateLimitScope.LOGIN_IP, value: input.ip },
  ];
  const limit = await checkAuthRateLimits(keys);
  if (!limit.allowed) return { ok: false, error: LoginErrorCode.RateLimited, retryAfterMs: limit.retryAfterMs };

  const user = identifier ? await findActiveAdminUserByIdentifier(identifier) : null;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    // También consultamos GoTrue cuando el usuario local no existe. Así la
    // respuesta observable no revela qué emails están registrados.
    email: user?.authUserId && user.authEmailCanonical ? user.authEmailCanonical : INVALID_LOGIN_EMAIL,
    password: password || "invalid-password",
  });
  if (error || !user?.authUserId || !password) {
    await registerFailedAuthAttempt(keys);
    return { ok: false, error: LoginErrorCode.InvalidCredentials };
  }

  await clearAuthAttempts(keys[0]);
  return { ok: true };
}
