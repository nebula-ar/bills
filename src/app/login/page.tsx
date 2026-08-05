import Link from "next/link";

import { LoginForm } from "./login-form";

type LoginPageProps = {
  searchParams: Promise<{
    callbackUrl?: string | string[];
    error?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const callbackUrl = getSafeCallbackUrl(getSingleParam(params.callbackUrl));
  const hasError = Boolean(getSingleParam(params.error));

  return (
    <main className="flex min-h-[100dvh] flex-col bg-slate-100 text-slate-950 sm:items-center sm:justify-center sm:px-6 sm:py-10">
      <section className="flex w-full flex-1 flex-col bg-white px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] sm:min-h-0 sm:max-w-[28rem] sm:flex-none sm:rounded-[2.5rem] sm:px-8 sm:py-10 sm:shadow-2xl sm:shadow-slate-950/15">
        <div className="flex flex-1 flex-col justify-center gap-8 sm:flex-none">
          <div className="grid gap-6 text-center">
            <Link
              className="mx-auto grid size-20 place-items-center rounded-[1.8rem] bg-linear-to-br from-blue-600 to-violet-600 text-3xl font-black tracking-[-0.08em] text-white shadow-lg shadow-blue-600/30 transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-4 active:scale-95"
              href="/"
              aria-label="Ir al inicio"
            >
              <span aria-label="Marca Bills" role="img">
                BB
              </span>
            </Link>

            <div>
              <p className="text-sm font-black tracking-[0.24em] text-blue-600">BILLS</p>
              <h1 className="mt-3 text-3xl font-black tracking-[-0.05em] text-slate-950">Bienvenido de nuevo</h1>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">Ingresá para administrar tu negocio.</p>
            </div>
          </div>

          {hasError ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700" role="alert">
              No pudimos iniciar sesión. Revisá tus datos e intentá de nuevo.
            </p>
          ) : null}

          <LoginForm callbackUrl={callbackUrl} />

          <div className="grid gap-3 text-center text-sm font-semibold text-slate-500">
            <p>
              ¿No tenés cuenta?{" "}
              <Link className="font-black text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2" href="/register">
                Registrá tu negocio
              </Link>
            </p>
            <Link className="font-bold text-slate-500 hover:text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2" href="/terminal">
              ¿Sos empleado? Ir a la terminal
            </Link>
          </div>
        </div>

        <p className="shrink-0 pt-8 text-center text-xs leading-5 text-slate-400">
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
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}
