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
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 sm:px-6 sm:py-10">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md flex-col justify-between overflow-hidden rounded-[2.5rem] bg-white px-6 py-8 shadow-[0_24px_80px_rgba(15,23,42,0.16)] ring-1 ring-slate-200 sm:min-h-[760px]">
        <div className="grid gap-8">
          <div className="grid justify-items-center gap-4 text-center">
            <div className="grid size-20 place-items-center rounded-[1.8rem] bg-blue-600 text-white shadow-[0_18px_40px_rgba(37,99,235,0.35)]">
              <span className="text-3xl font-black tracking-tight">BB</span>
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.24em] text-blue-600">BarberPro</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Bienvenido</h1>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                Acceso para dueños y administradores de Barber Bills.
              </p>
            </div>
          </div>

          {hasError ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              No pudimos iniciar sesión. Revisá tus datos e intentá de nuevo.
            </p>
          ) : null}

          <LoginForm callbackUrl={callbackUrl} />
        </div>

        <p className="pt-8 text-center text-xs font-medium leading-5 text-slate-400">
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
