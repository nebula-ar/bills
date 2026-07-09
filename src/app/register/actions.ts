"use server";

import { isEmailAvailable, registerBusiness, type RegisterBusinessInput, type RegisterResult } from "@/modules/auth/register-business.use-case";

export async function registerBusinessAction(input: RegisterBusinessInput): Promise<RegisterResult> {
  try {
    return await registerBusiness(input);
  } catch (error) {
    console.error(error);
    return { ok: false, error: "No pudimos crear la cuenta. Intentá de nuevo." };
  }
}

// Si falla el chequeo, devolvemos true (no bloqueamos): el submit revalida.
export async function checkEmailAvailableAction(email: string): Promise<boolean> {
  try {
    return await isEmailAvailable(email);
  } catch (error) {
    console.error(error);
    return true;
  }
}
