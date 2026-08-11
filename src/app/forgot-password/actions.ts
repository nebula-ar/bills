"use server";

import { logError } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type RequestResetResult = { ok: true } | { ok: false; error: string };

/**
 * Pide el link de recuperación a Supabase Auth (GoTrue manda el mail solo, no
 * hace falta proveedor de email propio acá).
 *
 * Responde `{ ok: true }` exista o no la cuenta: es el mismo criterio
 * anti-enumeración que ya usa `loginAdmin` para el login. Revelar "ese email
 * no existe" es un mapa de qué negocios usan Bills.
 */
export async function requestPasswordResetAction(input: { email: string }): Promise<RequestResetResult> {
  const email = input.email.trim().toLowerCase();
  if (!email) return { ok: false, error: "Ingresá tu email" };

  try {
    const supabase = await createSupabaseServerClient();
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/reset-password`,
    });

    // No se distingue el error de "no existe": GoTrue ya está pensado para no
    // filtrar eso, así que acá tampoco. Solo queda registrado para diagnóstico.
    if (error) await logError("auth.forgot-password", error, { context: { email } });
  } catch (error) {
    await logError("auth.forgot-password", error, { context: { email } });
  }

  return { ok: true };
}
