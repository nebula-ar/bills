import { cookies } from "next/headers";

const FLASH_COOKIE = "staff_flash";

export type StaffFlash = { status: "success" | "error"; message: string };

// Mensaje efímero para la terminal del empleado: viaja por cookie (no por la URL)
// y se limpia apenas se muestra como notificación.
export const STAFF_FLASH_COOKIE = FLASH_COOKIE;

export async function setStaffFlash(flash: StaffFlash) {
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

export async function readStaffFlash(): Promise<StaffFlash | null> {
  const store = await cookies();
  const raw = store.get(FLASH_COOKIE)?.value;
  if (!raw) {
    return null;
  }
  try {
    const data = JSON.parse(raw) as StaffFlash;
    if ((data.status === "success" || data.status === "error") && typeof data.message === "string") {
      return data;
    }
  } catch {
    // cookie inválida: la ignoramos
  }
  return null;
}

export async function clearStaffFlashCookie() {
  const store = await cookies();
  store.delete(FLASH_COOKIE);
}
