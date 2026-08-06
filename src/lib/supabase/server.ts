import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { supabaseAnonKey, supabaseCookieOptions, supabaseServerUrl } from "./config";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  // "Recordarme" (cookie bills.remember, seteada por loginAction): sin marcar
  // la sesión dura 8 h; marcando, 30 días. Sin la cookie se usa el default de
  // Supabase (cookie de sesión del navegador). El maxAge se aplica en cada
  // escritura de cookies, así que también se conserva al refrescar tokens.
  const baseCookieOptions = supabaseCookieOptions();
  const remember = cookieStore.get("bills.remember")?.value;
  const cookieOptions =
    remember === "1"
      ? { ...baseCookieOptions, maxAge: 60 * 60 * 24 * 30 }
      : remember === "0"
        ? { ...baseCookieOptions, maxAge: 60 * 60 * 8 }
        : baseCookieOptions;

  return createServerClient(supabaseServerUrl(), supabaseAnonKey(), {
    cookieOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Un Server Component no puede escribir cookies. `src/proxy.ts`
          // persiste los refresh; las Server Actions sí escriben normalmente.
        }
      },
    },
    auth: {
      flowType: "pkce",
    },
  });
}
