import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "barber_session";
// Duración del "turno": 8 horas.
const MAX_AGE_SECONDS = 8 * 60 * 60;

export type BarberSession = {
  branchId: string;
  barberId: string;
  exp: number;
};

function getSecret() {
  return process.env.NEXTAUTH_SECRET ?? "barber-session-dev-secret";
}

function sign(payload: string) {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function createBarberSessionToken(input: { branchId: string; barberId: string }) {
  const data: BarberSession = {
    branchId: input.branchId,
    barberId: input.barberId,
    exp: nowSeconds() + MAX_AGE_SECONDS,
  };
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyBarberSessionToken(token: string | undefined): BarberSession | null {
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
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as BarberSession;

    if (typeof data.branchId !== "string" || typeof data.barberId !== "string" || typeof data.exp !== "number") {
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

export async function getBarberSession(): Promise<BarberSession | null> {
  const store = await cookies();
  return verifyBarberSessionToken(store.get(COOKIE_NAME)?.value);
}

export async function setBarberSessionCookie(input: { branchId: string; barberId: string }) {
  const store = await cookies();
  store.set(COOKIE_NAME, createBarberSessionToken(input), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
    // En la LAN se usa por HTTP; solo forzamos secure en producción.
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearBarberSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
