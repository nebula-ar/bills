import { AppShell, Card, PageHeader } from "@/components/app-shell";
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
    <AppShell maxWidth="lg">
        <PageHeader
          title="Servicios"
          description={
            selectedBranch
              ? `${selectedBranch.business.name} · catálogo global y configuración por sucursal`
              : "No hay una sucursal disponible."
          }
          actions={
            <>
            <Link className="rounded-2xl bg-blue-600 px-4 py-3 text-white hover:bg-blue-700" href="/sales/new">
              Registrar venta
            </Link>
            <LogoutButton />
            </>
          }
        />

        {message && isSupportedStatus(status) ? (
          <p
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
              status === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {message}
          </p>
        ) : null}

        {selectedBranch ? (
          <>
            <Card>
              <h2 className="text-xl font-black text-slate-950">Sucursal a configurar</h2>
              <p className="mt-2 text-sm text-slate-500">
                Elegí la sucursal para ver disponibilidad y precios de cada servicio.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {branches.map((branch) => (
                  <Link
                    className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
                      branch.id === selectedBranch.id
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-200 text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    }`}
                    href={`/services?branchId=${branch.id}`}
                    key={branch.id}
                  >
                    {branch.name}
                  </Link>
                ))}
              </div>
            </Card>

            <form action={createService} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <input name="branchId" type="hidden" value={selectedBranch.id} />
              <h2 className="text-xl font-black text-slate-950">Catálogo de servicios</h2>
              <p className="mt-2 text-sm text-slate-500">
                Agregá servicios al catálogo del negocio y configurá su precio por sucursal.
              </p>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Nombre
                  <input
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-slate-950 focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
                    name="name"
                    required
                    type="text"
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Descripción
                  <input
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-slate-950 focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
                    name="description"
                    type="text"
                  />
                </label>

              </div>
              <button
                className="mt-5 rounded-2xl bg-blue-600 px-4 py-3 font-bold text-white hover:bg-blue-700"
                type="submit"
              >
                Agregar al catálogo
              </button>
            </form>

            <section className="space-y-4">
              <div>
                <h2 className="text-xl font-black text-slate-950">Configuración por sucursal</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Sucursal seleccionada: {selectedBranch.name}. Cada servicio necesita precio propio en esta sucursal para poder venderse.
                </p>
              </div>

              {services.length === 0 ? (
                <Card className="text-slate-600">
                  Todavía no hay servicios en el catálogo.
                </Card>
              ) : (
                services.map((service) => {
                  const configured = service.configured;
                  const branchPrice = service.branchPrice;
                  const priceDefaultValue = branchPrice?.price ?? service.suggestedPrice ?? "";

                  return (
                    <form
                      action={saveBranchServiceConfig}
                      className={`rounded-3xl border bg-white p-5 shadow-sm ${
                        configured ? "border-slate-200" : "border-blue-200 ring-4 ring-blue-50"
                      }`}
                      key={service.id}
                    >
                      <input name="branchId" type="hidden" value={selectedBranch.id} />
                      <input name="serviceId" type="hidden" value={service.id} />

                      <div className="grid gap-4 md:grid-cols-[1fr_10rem_8rem_auto] md:items-end">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-black text-slate-950">{service.name}</h3>
                            {!configured ? (
                              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">
                                Configurar en esta sucursal
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-slate-500">
                            {service.description ?? "Sin descripción"}
                          </p>
                          <p
                            className={`mt-2 text-sm font-medium ${
                              branchPrice?.active ? "text-emerald-700" : configured ? "text-slate-400" : "text-blue-700"
                            }`}
                          >
                            {branchPrice
                              ? `${formatMoney(branchPrice.price)} · ${branchPrice.active ? "Disponible" : "No disponible"}`
                              : getUnconfiguredServiceCopy(service.suggestedPrice)}
                          </p>
                        </div>

                        <label className="grid gap-2 text-sm font-semibold text-slate-700">
                          {configured ? "Precio" : "Precio para habilitar"}
                          <input
                            className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-slate-950 focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
                            defaultValue={priceDefaultValue}
                            min={1}
                            name="price"
                            placeholder="Ej: 5000"
                            required
                            step={1}
                            type="number"
                          />
                        </label>

                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 md:pb-3">
                          <input
                            className="h-4 w-4 accent-blue-600"
                            defaultChecked={branchPrice?.active ?? true}
                            name="active"
                            type="checkbox"
                          />
                          Disponible
                        </label>

                        <button
                          className={`rounded-lg px-4 py-3 font-semibold ${
                            configured
                              ? "border border-slate-200 text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                              : "bg-blue-600 text-white hover:bg-blue-700"
                          }`}
                          type="submit"
                        >
                          {configured ? "Guardar configuración" : "Habilitar en esta sucursal"}
                        </button>
                      </div>
                    </form>
                  );
                })
              )}
            </section>
          </>
        ) : (
          <Card className="text-slate-600">
            Ejecutá el seed o cargá una sucursal para administrar servicios.
          </Card>
        )}
    </AppShell>
  );
}

function formatMoney(value: number) {
  return moneyFormatter.format(value);
}

function getUnconfiguredServiceCopy(suggestedPrice: number | null) {
  return suggestedPrice ? `Precio sugerido: ${formatMoney(suggestedPrice)}` : "Cargá un precio para habilitarlo.";
}

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isSupportedStatus(status: string | undefined): status is "error" | "success" {
  return status === "error" || status === "success";
}
