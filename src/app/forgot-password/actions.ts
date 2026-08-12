"use server";

import { logError } from "@/lib/logger";
import { resetPasswordDirect, type ResetPasswordDirectResult } from "@/modules/auth/reset-password-direct.use-case";

export async function resetPasswordDirectAction(input: {
  email: string;
  password: string;
}): Promise<ResetPasswordDirectResult> {
  try {
    return await resetPasswordDirect(input);
  } catch (error) {
    await logError("auth.reset-password-direct", error, { context: { email: input.email } });
    return { ok: false, error: "No pudimos actualizar la contraseña. Probá de nuevo." };
  }
}
