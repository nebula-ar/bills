import { LogoutButton } from "@/components/logout-button";
import { requireAdminSession } from "@/lib/auth";
import { getBranchServiceConfiguration } from "@/modules/services/get-branch-service-configuration.use-case";
import Link from "next/link";

import { createService, saveBranchServiceConfig } from "./actions";

const moneyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

type ServicesPageProps = {
  searchParams: Promise<{
    branchId?: string | string[];
    status?: string | string[];
    message?: string | string[];
  }>;
};

export default async function ServicesPage({ searchParams }: ServicesPageProps) {
  await requireAdminSession();

  const params = await searchParams;
  const selectedBranchId = getSingleParam(params.branchId);
  const status = getSingleParam(params.status);
  const message = getSingleParam(params.message);
  const serviceManagement = await getBranchServiceConfiguration(selectedBranchId);
  const { branches, selectedBranch, services } = serviceManagement;

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-50">
      <section className="mx-auto flex max-w-4xl flex-col gap-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-amber-400">
              Barber Bills
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight">Servicios</h1>
            <p className="mt-2 text-zinc-400">
              {selectedBranch
                ? `${selectedBranch.business.name} · catálogo global y configuración por sucursal`
                : "No hay una sucursal disponible."}
            </p>
          </div>
          <div className="flex gap-4 text-sm font-medium">
            <Link className="text-zinc-300 hover:text-zinc-50" href="/">
              Inicio
            </Link>
            <Link className="text-zinc-300 hover:text-zinc-50" href="/sales/new">
              Registrar venta
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

        {selectedBranch ? (
          <>
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <h2 className="text-xl font-semibold">Sucursal a configurar</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Elegí la sucursal para ver disponibilidad y precios de cada servicio.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {branches.map((branch) => (
                  <Link
                    className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
                      branch.id === selectedBranch.id
                        ? "border-amber-400 bg-amber-400 text-zinc-950"
                        : "border-zinc-700 text-zinc-100 hover:border-zinc-500"
                    }`}
                    href={`/services?branchId=${branch.id}`}
                    key={branch.id}
                  >
                    {branch.name}
                  </Link>
                ))}
              </div>
            </section>

            <form action={createService} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <input name="branchId" type="hidden" value={selectedBranch.id} />
              <h2 className="text-xl font-semibold">Catálogo de servicios</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Estos servicios pertenecen al negocio. Después configurás en qué sucursales están disponibles y a qué precio.
              </p>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
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
                  Descripción
                  <input
                    className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-50"
                    name="description"
                    type="text"
                  />
                </label>

              </div>
              <button
                className="mt-5 rounded-lg bg-amber-400 px-4 py-3 font-semibold text-zinc-950 hover:bg-amber-300"
                type="submit"
              >
                Agregar al catálogo
              </button>
            </form>

            <section className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Configuración por sucursal</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Sucursal seleccionada: {selectedBranch.name}. Marcá disponibilidad y guardá el precio en pesos argentinos.
                </p>
              </div>

              {services.length === 0 ? (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-zinc-300">
                  Todavía no hay servicios en el catálogo.
                </div>
              ) : (
                services.map((service) => (
                  <form
                    action={saveBranchServiceConfig}
                    className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
                    key={service.id}
                  >
                    <input name="branchId" type="hidden" value={selectedBranch.id} />
                    <input name="serviceId" type="hidden" value={service.id} />

                    <div className="grid gap-4 md:grid-cols-[1fr_10rem_8rem_auto] md:items-end">
                      <div>
                        <h3 className="text-lg font-semibold">{service.name}</h3>
                        <p className="mt-1 text-sm text-zinc-400">
                          {service.description ?? "Sin descripción"}
                        </p>
                        <p className={`mt-2 text-sm font-medium ${service.branchPrice?.active ? "text-emerald-300" : "text-zinc-500"}`}>
                          {service.branchPrice
                            ? `${formatMoney(service.branchPrice.price)} · ${service.branchPrice.active ? "Disponible" : "No disponible"}`
                            : "Sin precio configurado para esta sucursal"}
                        </p>
                      </div>

                      <label className="grid gap-2 text-sm font-medium text-zinc-200">
                        Precio
                        <input
                          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-50"
                          defaultValue={service.branchPrice?.price ?? ""}
                          min={1}
                          name="price"
                          required
                          step={1}
                          type="number"
                        />
                      </label>

                      <label className="flex items-center gap-2 text-sm font-medium text-zinc-200 md:pb-3">
                        <input
                          className="h-4 w-4 accent-amber-400"
                          defaultChecked={service.branchPrice?.active ?? true}
                          name="active"
                          type="checkbox"
                        />
                        Disponible
                      </label>

                      <button
                        className="rounded-lg border border-zinc-700 px-4 py-3 font-semibold text-zinc-100 hover:border-zinc-500"
                        type="submit"
                      >
                        Guardar configuración
                      </button>
                    </div>
                  </form>
                ))
              )}
            </section>
          </>
        ) : (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-zinc-300">
            Ejecutá el seed o cargá una sucursal para administrar servicios.
          </div>
        )}
      </section>
    </main>
  );
}

function formatMoney(value: number) {
  return moneyFormatter.format(value);
}

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isSupportedStatus(status: string | undefined): status is "error" | "success" {
  return status === "error" || status === "success";
}
