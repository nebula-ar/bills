"use server";

import { getCurrentSession } from "@/lib/auth";
import { logError } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ResetPasswordResult = { ok: true } | { ok: false; error: string };

export async function resetPasswordAction(input: { password: string }): Promise<ResetPasswordResult> {
  // La sesión de recuperación la dejó `exchangeCodeForSession` en
  // /reset-password (route.ts). Sin sesión válida no hay a quién cambiarle la
  // contraseña: el link venció, ya se usó, o directamente no vino de ahí.
  const session = await getCurrentSession();
  if (!session) return { ok: false, error: "Este link ya venció o ya se usó. Pedí uno nuevo." };

  if (input.password.length < 8) {
    return { ok: false, error: "La contraseña tiene que tener al menos 8 caracteres" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: input.password });

  if (error) {
    await logError("auth.reset-password", error, { userId: session.user.id });
    return { ok: false, error: "No pudimos actualizar la contraseña. Probá de nuevo." };
  }

  return { ok: true };
}
