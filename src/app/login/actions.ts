"use server";

import { headers } from "next/headers";

import { LoginErrorCode } from "@/lib/auth-errors";
import { logError } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loginAdmin, type LoginResult } from "@/modules/auth/login-admin.use-case";

function clientIp(store: Awaited<ReturnType<typeof headers>>): string {
  return store.get("x-forwarded-for")?.split(",")[0]?.trim() || store.get("x-real-ip") || "unknown";
}

export async function loginAction(input: { identifier: string; password: string }): Promise<LoginResult> {
  try {
    const store = await headers();
    return await loginAdmin({ ...input, ip: clientIp(store) });
  } catch (error) {
    await logError("auth.login", error);
    return { ok: false, error: LoginErrorCode.Network };
  }
}

export async function logoutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}
