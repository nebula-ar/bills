"use server";

import { logError } from "@/lib/logger";
import { isEmailAvailable, registerBusiness, type RegisterBusinessInput, type RegisterResult } from "@/modules/auth/register-business.use-case";

export async function registerBusinessAction(input: RegisterBusinessInput): Promise<RegisterResult> {
  try {
    return await registerBusiness(input);
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
