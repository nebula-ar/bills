import { NextResponse, type NextRequest } from "next/server";

import { logError } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * A donde llega el link que manda `resetPasswordForEmail`. No es la pantalla
 * del formulario: es el canje del código PKCE por una sesión.
 *
 * Tiene que ser un Route Handler y no un Server Component: un Server
 * Component no puede escribir cookies (ver `createSupabaseServerClient`), y
 * sin la cookie de sesión el paso siguiente —`updateUser({ password })`— no
 * tiene con qué autenticarse.
 */
export async function GET(request: NextRequest) {
  const appUrl = process.env.APP_URL ?? request.nextUrl.origin;
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${appUrl}/forgot-password?estado=error`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    await logError("auth.reset-password-exchange", error);
    return NextResponse.redirect(`${appUrl}/forgot-password?estado=vencido`);
  }

  return NextResponse.redirect(`${appUrl}/reset-password/nueva-contrasena`);
}
