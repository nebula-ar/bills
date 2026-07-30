import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "staff_session";
// Duración del "turno": 8 horas.
const MAX_AGE_SECONDS = 8 * 60 * 60;

export type StaffSession = {
  branchId: string;
  staffId: string;
  terminalId?: string;
  exp: number;
};

function getSecret() {
  return process.env.NEXTAUTH_SECRET ?? "staff-session-dev-secret";
}

function sign(payload: string) {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function createStaffSessionToken(input: { branchId: string; staffId: string; terminalId?: string | null }) {
  const data: StaffSession = {
    branchId: input.branchId,
    staffId: input.staffId,
    exp: nowSeconds() + MAX_AGE_SECONDS,
  };
  if (input.terminalId) {
    data.terminalId = input.terminalId;
  }
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyStaffSessionToken(token: string | undefined): StaffSession | null {
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature) {
    return null;
  }

  const expected = sign(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as StaffSession;

    if (typeof data.branchId !== "string" || typeof data.staffId !== "string" || typeof data.exp !== "number") {
      return null;
    }

    if (data.exp <= nowSeconds()) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

export async function getStaffSession(): Promise<StaffSession | null> {
  const store = await cookies();
  return verifyStaffSessionToken(store.get(COOKIE_NAME)?.value);
}

export async function setStaffSessionCookie(input: { branchId: string; staffId: string; terminalId?: string | null }) {
  const store = await cookies();
  store.set(COOKIE_NAME, createStaffSessionToken(input), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
    // En la LAN se usa por HTTP; solo forzamos secure en producción.
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearStaffSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
