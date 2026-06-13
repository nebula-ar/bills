import { LogoutButton } from "@/components/logout-button";
import { requireAdminSession } from "@/lib/auth";
import { getBarbersForManagement } from "@/modules/barbers/get-barbers-for-management.use-case";
import Link from "next/link";

import { createBarber, updateBarber } from "./actions";

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
  const { barbers, branches } = await getBarbersForManagement();

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-50">
      <section className="mx-auto flex max-w-5xl flex-col gap-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-amber-400">Barber Bills</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight">Barberos</h1>
            <p className="mt-2 text-zinc-400">Administrá sucursal, estado y PIN de cada barbero.</p>
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

        <form action={createBarber} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-5">
            <h2 className="text-xl font-semibold">Crear barbero</h2>
            <p className="mt-1 text-sm text-zinc-400">El PIN se guarda protegido y no se muestra después.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_1fr_12rem_auto] md:items-end">
            <label className="grid gap-2 text-sm font-medium text-zinc-200">
              Nombre
              <input
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-50"
                name="name"
                required
                type="text"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-zinc-200">
              Sucursal
              <select
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-50"
                disabled={branches.length === 0}
                name="branchId"
                required
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.business.name} · {branch.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium text-zinc-200">
              PIN
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
              className="rounded-lg bg-amber-400 px-4 py-3 font-semibold text-zinc-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
              disabled={branches.length === 0}
              type="submit"
            >
              Crear
            </button>
          </div>
        </form>

        {barbers.length > 0 ? (
          <section className="space-y-4">
            {barbers.map((barber) => (
              <form action={updateBarber} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5" key={barber.id}>
                <input name="barberId" type="hidden" value={barber.id} />
                <div className="grid gap-4 lg:grid-cols-[1fr_1fr_9rem_12rem_auto] lg:items-end">
                  <div>
                    <h2 className="text-lg font-semibold">{barber.name}</h2>
                    <p className="mt-1 text-sm text-zinc-400">
                      {barber.branch ? `${barber.branch.business.name} · ${barber.branch.name}` : "Sin sucursal"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium">
                      <span className={barber.active ? "text-emerald-300" : "text-zinc-400"}>
                        {barber.active ? "Activo" : "Inactivo"}
                      </span>
                      <span className={barber.pinHash ? "text-emerald-300" : "text-amber-300"}>
                        {barber.pinHash ? "PIN configurado" : "Sin PIN configurado"}
                      </span>
                    </div>
                  </div>

                  <label className="grid gap-2 text-sm font-medium text-zinc-200">
                    Sucursal
                    <select
                      className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-50"
                      name="branchId"
                      required
                      defaultValue={barber.branchId ?? ""}
                    >
                      {!barber.branchId ? <option value="">Elegí una sucursal</option> : null}
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.business.name} · {branch.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-sm font-medium text-zinc-200 lg:mb-0.5">
                    <input className="size-4 accent-amber-400" defaultChecked={barber.active} name="active" type="checkbox" />
                    Activo
                  </label>

                  <label className="grid gap-2 text-sm font-medium text-zinc-200">
                    Nuevo PIN opcional
                    <input
                      autoComplete="off"
                      className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-50"
                      inputMode="numeric"
                      maxLength={8}
                      minLength={4}
                      name="pin"
                      pattern="[0-9]*"
                      type="password"
                    />
                  </label>

                  <button
                    className="rounded-lg border border-zinc-700 px-4 py-3 font-semibold text-zinc-100 hover:border-zinc-500"
                    type="submit"
                  >
                    Guardar
                  </button>
                </div>
              </form>
            ))}
          </section>
        ) : (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-zinc-300">
            Todavía no hay barberos cargados.
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
