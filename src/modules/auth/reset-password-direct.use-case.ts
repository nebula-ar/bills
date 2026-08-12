import "server-only";

import { logEvent } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { findActiveAdminUserByIdentifier } from "./user.repository";

export type ResetPasswordDirectResult = { ok: true } | { ok: false; error: string };

/**
 * Cambia la contraseña con solo el email, SIN probar que quien lo pide es
 * dueño de esa casilla.
 *
 * Decisión explícita del dueño del producto mientras no hay SMTP propio para
 * el flujo seguro (link por mail, ver `/reset-password`): cualquiera que sepa
 * el email de una cuenta puede tomarla. No es un descuido, es una deuda de
 * seguridad conocida y aceptada para poder destrabarse ahora — hay que
 * revisar esto antes de tener clientes reales. El flujo seguro sigue en el
 * repo, sin usarse, para cuando haya SMTP.
 *
 * Se loguea cada uso exitoso: dado el riesgo, que quede quién cambió qué
 * cuenta y cuándo es lo mínimo para poder auditar después.
 */
export async function resetPasswordDirect(input: { email: string; password: string }): Promise<ResetPasswordDirectResult> {
  const email = input.email.trim().toLowerCase();
  if (!email) return { ok: false, error: "Ingresá tu email" };
  if (input.password.length < 8) {
    return { ok: false, error: "La contraseña tiene que tener al menos 8 caracteres" };
  }

  const user = await findActiveAdminUserByIdentifier(email);
  if (!user?.authUserId) {
    return { ok: false, error: "No encontramos una cuenta activa con ese email" };
  }

  const admin = await createSupabaseAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user.authUserId, { password: input.password });

  if (error) {
    return { ok: false, error: "No pudimos actualizar la contraseña. Probá de nuevo." };
  }

  await logEvent("auth.reset-password-direct", `Contraseña cambiada sin verificación de email para ${email}`, {
    userId: user.id,
    businessId: user.businessId,
  });

  return { ok: true };
}
