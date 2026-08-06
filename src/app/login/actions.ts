"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { LoginErrorCode } from "@/lib/auth-errors";
import { logError } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loginAdmin, type LoginResult } from "@/modules/auth/login-admin.use-case";

// Duración de la sesión según "Recordarme" (ver src/lib/supabase/server.ts).
const REMEMBER_COOKIE = "bills.remember";
const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

function clientIp(store: Awaited<ReturnType<typeof headers>>): string {
  return store.get("x-forwarded-for")?.split(",")[0]?.trim() || store.get("x-real-ip") || "unknown";
}

export async function loginAction(input: {
  identifier: string;
  password: string;
  remember: boolean;
}): Promise<LoginResult> {
  try {
    const store = await headers();
    // La preferencia se persiste ANTES de crear la sesión: el cliente Supabase
    // la lee al escribir las cookies de auth y les aplica el maxAge (8 h sin
    // Recordarme, 30 días marcando). En requests siguientes la misma cookie
    // mantiene el maxAge al refrescar tokens.
    const cookieStore = await cookies();
    cookieStore.set(REMEMBER_COOKIE, input.remember ? "1" : "0", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.APP_URL?.trim().toLowerCase().startsWith("https://") ?? false,
      path: "/",
      maxAge: THIRTY_DAYS_SECONDS,
    });

    return await loginAdmin({ ...input, ip: clientIp(store) });
  } catch (error) {
    await logError("auth.login", error);
    return { ok: false, error: LoginErrorCode.Network };
  }
}

export async function googleSignInAction(): Promise<never> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.APP_URL ?? "http://localhost:3000"}/login`,
    },
  });

  if (error || !data.url) {
    await logError("auth.google-oauth", error ?? new Error("signInWithOAuth sin URL"));
    throw new Error("google-oauth-no-configurado");
  }

  redirect(data.url);
}

export async function logoutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(REMEMBER_COOKIE);
}
