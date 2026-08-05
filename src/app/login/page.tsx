import Link from "next/link";

import { LoginForm } from "./login-form";

type LoginPageProps = {
  searchParams: Promise<{
    callbackUrl?: string | string[];
    error?: string | string[];
  }>;
};

// El login usa el mismo sistema visual que la landing (hero.tsx): fondo crema,
// tipografía display bien pesada, el logo negro con la B lima y el azul var(--primary)
// como único acento. Antes era otra marca —logo violeta "BB", fondo lavanda,
// botón azul con glow— y se notaba el salto al entrar desde la home.
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const callbackUrl = getSafeCallbackUrl(getSingleParam(params.callbackUrl));
  const hasError = Boolean(getSingleParam(params.error));

  return (
    <main className="flex min-h-[100dvh] flex-col bg-[var(--background)] text-slate-950 sm:items-center sm:justify-center sm:px-6 sm:py-10">
      {/* En celular ocupa toda la pantalla (es una PWA y el login es la primera
          pantalla real); de sm para arriba se convierte en tarjeta centrada. */}
      <section className="flex w-full flex-1 flex-col bg-[var(--card)] px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] sm:min-h-0 sm:max-w-[26rem] sm:flex-none sm:rounded-[28px] sm:border sm:border-slate-950/10 sm:px-8 sm:py-10 sm:shadow-[0_30px_80px_-20px_rgba(17,19,21,0.32)]">
        <div className="flex flex-1 flex-col justify-center gap-7 sm:flex-none">
          <div className="grid gap-5">
            {/* El logo vuelve a la home: sin esto el login es un callejón sin
                salida para quien entró a mirar y todavía no tiene cuenta. */}
            <Link
              className="inline-flex w-fit items-center gap-2.5 rounded-xl text-lg font-black tracking-[-0.04em] text-slate-950 transition hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
              href="/"
            >
              <span className="grid size-9 place-items-center rounded-xl bg-slate-950 text-base font-black text-[var(--accent-brand)]">B</span>
              Bills
            </Link>

            <div>
              <h1 className="text-[2.5rem] font-black leading-[0.95] tracking-[-0.06em] text-slate-950">
                Iniciá sesión
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Ingresá con los datos de tu cuenta.
              </p>
            </div>
          </div>

          {hasError ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              No pudimos iniciar sesión. Revisá tus datos e intentá de nuevo.
            </p>
          ) : null}

          <LoginForm callbackUrl={callbackUrl} />

          <p className="border-t border-slate-200 pt-6 text-sm text-slate-600">
            ¿No tenés cuenta?{" "}
            <Link className="font-black text-[var(--primary)] hover:underline" href="/register">
              Registrá tu negocio
            </Link>
          </p>
        </div>

        <p className="shrink-0 pt-8 text-xs leading-5 text-slate-400">
          Al ingresar aceptás los términos de uso y la política de privacidad.
        </p>
      </section>
    </main>
  );
}

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getSafeCallbackUrl(value: string | undefined) {
  if (!value || !value.startsWith("/")) {
    return "/";
  }

  if (value.startsWith("//")) {
    return "/";
  }

  return value;
}
