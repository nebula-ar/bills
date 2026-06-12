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
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-50">
      <section className="mx-auto flex max-w-md flex-col gap-8">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-amber-400">
            Barber Bills
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">Ingresar</h1>
          <p className="mt-2 text-zinc-400">Acceso para administración del negocio.</p>
        </div>

        {hasError ? (
          <p className="rounded-xl border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-200">
            No pudimos iniciar sesión. Revisá tus datos e intentá de nuevo.
          </p>
        ) : null}

        <LoginForm callbackUrl={callbackUrl} />
      </section>
    </main>
  );
}

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getSafeCallbackUrl(value: string | undefined) {
  if (!value || !value.startsWith("/")) {
    return "/sales";
  }

  if (value.startsWith("//")) {
    return "/sales";
  }

  return value;
}
