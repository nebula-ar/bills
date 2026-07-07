"use server";

import { registerBusiness, type RegisterBusinessInput, type RegisterResult } from "@/modules/auth/register-business.use-case";

export async function registerBusinessAction(input: RegisterBusinessInput): Promise<RegisterResult> {
  try {
    return await registerBusiness(input);
  } catch (error) {
    console.error(error);
    return { ok: false, error: "No pudimos crear la cuenta. Intentá de nuevo." };
  }
}
