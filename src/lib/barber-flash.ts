import { cookies } from "next/headers";

const FLASH_COOKIE = "barber_flash";

export type BarberFlash = { status: "success" | "error"; message: string };

// Mensaje efímero para la terminal del barbero: viaja por cookie (no por la URL)
// y se limpia apenas se muestra como notificación.
export const BARBER_FLASH_COOKIE = FLASH_COOKIE;

export async function setBarberFlash(flash: BarberFlash) {
  const store = await cookies();
  // No httpOnly: la notificación la borra el cliente al mostrarla (sin refrescar la página).
  store.set(FLASH_COOKIE, JSON.stringify(flash), {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 20,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function readBarberFlash(): Promise<BarberFlash | null> {
  const store = await cookies();
  const raw = store.get(FLASH_COOKIE)?.value;
  if (!raw) {
    return null;
  }
  try {
    const data = JSON.parse(raw) as BarberFlash;
    if ((data.status === "success" || data.status === "error") && typeof data.message === "string") {
      return data;
    }
  } catch {
    // cookie inválida: la ignoramos
  }
  return null;
}

export async function clearBarberFlashCookie() {
  const store = await cookies();
  store.delete(FLASH_COOKIE);
}
