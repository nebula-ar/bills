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
      <section className="flex w-full flex-1 flex-col bg-white px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] sm:min-h-0 sm:max-w-md sm:flex-none sm:rounded-[2.5rem] sm:px-8 sm:py-10 sm:shadow-[0_24px_80px_rgba(15,23,42,0.16)] sm:ring-1 sm:ring-slate-200">
        {/* Marca + formulario: centrados verticalmente en el alto disponible */}
        <div className="flex flex-1 flex-col justify-center gap-8 sm:flex-none">
          <div className="grid justify-items-center gap-4 text-center">
            <div className="grid size-20 place-items-center rounded-[1.8rem] bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-[0_18px_40px_rgba(37,99,235,0.35)]">
              <span className="text-3xl font-black tracking-tight">BB</span>
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.24em] text-blue-600">Barber Bills</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Bienvenido de nuevo</h1>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">Ingresá para administrar tu barbería.</p>
            </div>
          </div>

          {hasError ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              No pudimos iniciar sesión. Revisá tus datos e intentá de nuevo.
            </p>
          ) : null}

          <LoginForm callbackUrl={callbackUrl} />

          <p className="text-center text-sm font-semibold text-slate-500">
            ¿No tenés cuenta?{" "}
            <Link className="font-black text-blue-600" href="/register">
              Registrá tu barbería
            </Link>
          </p>

          <p className="text-center text-sm font-semibold text-slate-500">
            ¿Sos barbero?{" "}
            <Link className="font-black text-blue-600" href="/barber">
              Ir a la terminal
            </Link>
          </p>
        </div>

        <p className="shrink-0 pt-8 text-center text-xs font-medium leading-5 text-slate-400">
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
