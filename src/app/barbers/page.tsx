import { LogoutButton } from "@/components/logout-button";
import { requireAdminSession } from "@/lib/auth";
import { getBarbersForManagement } from "@/modules/barbers/get-barbers-for-management.use-case";
import Link from "next/link";

import { saveBarberPin } from "./actions";

type BarbersPageProps = {
  searchParams: Promise<{
    status?: string | string[];
    message?: string | string[];
  }>;
};

export default async function BarbersPage({ searchParams }: BarbersPageProps) {
  await requireAdminSession();

  const params = await searchParams;
  const status = getSingleParam(params.status);
  const message = getSingleParam(params.message);
  const barbers = await getBarbersForManagement();

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-50">
      <section className="mx-auto flex max-w-4xl flex-col gap-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-amber-400">Barber Bills</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight">Barberos</h1>
            <p className="mt-2 text-zinc-400">Configurá el PIN que usa cada barbero en la terminal compartida.</p>
          </div>
          <div className="flex gap-4 text-sm font-medium">
            <Link className="text-zinc-300 hover:text-zinc-50" href="/">
              Inicio
            </Link>
            <LogoutButton />
          </div>
        </div>

        {message && isSupportedStatus(status) ? (
          <p
            className={`rounded-xl border px-4 py-3 text-sm ${
              status === "success"
                ? "border-emerald-800 bg-emerald-950 text-emerald-200"
                : "border-red-800 bg-red-950 text-red-200"
            }`}
          >
            {message}
          </p>
        ) : null}

        {barbers.length > 0 ? (
          <section className="space-y-4">
            {barbers.map((barber) => (
              <form action={saveBarberPin} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5" key={barber.id}>
                <input name="barberId" type="hidden" value={barber.id} />
                <div className="grid gap-4 md:grid-cols-[1fr_12rem_auto] md:items-end">
                  <div>
                    <h2 className="text-lg font-semibold">{barber.name}</h2>
                    <p className="mt-1 text-sm text-zinc-400">
                      {barber.branch?.business.name} · {barber.branch?.name}
                    </p>
                    <p className={`mt-2 text-sm font-medium ${barber.pinHash ? "text-emerald-300" : "text-amber-300"}`}>
                      {barber.pinHash ? "PIN configurado" : "Sin PIN configurado"}
                    </p>
                  </div>

                  <label className="grid gap-2 text-sm font-medium text-zinc-200">
                    Nuevo PIN
                    <input
                      autoComplete="off"
                      className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-50"
                      inputMode="numeric"
                      maxLength={8}
                      minLength={4}
                      name="pin"
                      pattern="[0-9]*"
                      required
                      type="password"
                    />
                  </label>

                  <button
                    className="rounded-lg border border-zinc-700 px-4 py-3 font-semibold text-zinc-100 hover:border-zinc-500"
                    type="submit"
                  >
                    Guardar PIN
                  </button>
                </div>
              </form>
            ))}
          </section>
        ) : (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-zinc-300">
            No hay barberos activos para configurar.
          </div>
        )}
      </section>
    </main>
  );
}

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isSupportedStatus(status: string | undefined): status is "error" | "success" {
  return status === "error" || status === "success";
}
