import { LogoutButton } from "@/components/logout-button";
import { requireAdminSession } from "@/lib/auth";
import { getBranchesForManagement } from "@/modules/branches/get-branches-for-management.use-case";
import Link from "next/link";

import { createBranch, updateBranch } from "./actions";

type BranchesPageProps = {
  searchParams: Promise<{
    status?: string | string[];
    message?: string | string[];
  }>;
};

export default async function BranchesPage({ searchParams }: BranchesPageProps) {
  await requireAdminSession();

  const params = await searchParams;
  const status = getSingleParam(params.status);
  const message = getSingleParam(params.message);
  const branches = await getBranchesForManagement();

  return (
    <main className="min-h-screen bg-zinc-950 px-6 pb-28 pt-10 text-zinc-50 md:pb-10">
      <section className="mx-auto flex max-w-5xl flex-col gap-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-amber-400">Barber Bills</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight">Sucursales</h1>
            <p className="mt-2 text-zinc-400">Administrá nombre, dirección y estado de cada sucursal.</p>
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

        <form action={createBranch} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-5">
            <h2 className="text-xl font-semibold">Crear sucursal</h2>
            <p className="mt-1 text-sm text-zinc-400">Las sucursales nuevas quedan activas por defecto.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
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
              Dirección
              <input
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-50"
                name="address"
                type="text"
              />
            </label>

            <button className="rounded-lg bg-amber-400 px-4 py-3 font-semibold text-zinc-950 hover:bg-amber-300" type="submit">
              Crear
            </button>
          </div>
        </form>

        {branches.length > 0 ? (
          <section className="space-y-4">
            {branches.map((branch) => (
              <form action={updateBranch} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5" key={branch.id}>
                <input name="branchId" type="hidden" value={branch.id} />
                <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_9rem_auto] lg:items-end">
                  <div>
                    <h2 className="text-lg font-semibold">{branch.name}</h2>
                    <p className="mt-1 text-sm text-zinc-400">{branch.business.name}</p>
                    <span className={`mt-2 inline-flex text-xs font-medium ${branch.active ? "text-emerald-300" : "text-zinc-400"}`}>
                      {branch.active ? "Activa" : "Inactiva"}
                    </span>
                  </div>

                  <label className="grid gap-2 text-sm font-medium text-zinc-200">
                    Nombre
                    <input
                      className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-50"
                      defaultValue={branch.name}
                      name="name"
                      required
                      type="text"
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-medium text-zinc-200">
                    Dirección
                    <input
                      className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-50"
                      defaultValue={branch.address ?? ""}
                      name="address"
                      type="text"
                    />
                  </label>

                  <label className="flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-sm font-medium text-zinc-200 lg:mb-0.5">
                    <input className="size-4 accent-amber-400" defaultChecked={branch.active} name="active" type="checkbox" />
                    Activa
                  </label>

                  <button className="rounded-lg border border-zinc-700 px-4 py-3 font-semibold text-zinc-100 hover:border-zinc-500" type="submit">
                    Guardar
                  </button>
                </div>
              </form>
            ))}
          </section>
        ) : (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-zinc-300">
            Todavía no hay sucursales cargadas.
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
