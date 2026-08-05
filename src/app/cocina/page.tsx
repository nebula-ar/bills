import { AppShell, PageHeader } from "@/components/app-shell";
import { EmptyState, Field, GhostButton, selectClass } from "@/components/manager-ui";
import { AppModule, KdsStatus } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { formatQuantity } from "@/lib/quantity";
import { getBranchesForManagement } from "@/modules/branches/get-branches-for-management.use-case";
import { COLUMNAS_COCINA, nivelDeDemora, textoDeEspera } from "@/modules/tables/kitchen";
import { findRenglonesDeCocina } from "@/modules/tables/kitchen.repository";

import { avanzarAction } from "./actions";

/**
 * La pantalla que mira el cocinero mientras trabaja.
 *
 * No es de gestión: se lee con las manos ocupadas, de reojo y a un metro de
 * distancia. Por eso las tres columnas grandes, el nombre de la MESA arriba
 * (nadie sabe qué es la comanda #47, todos saben qué es "Vereda 1") y el
 * semáforo de demora en color.
 *
 * Se refresca sola: en una cocina nadie va a tocar F5 con las manos llenas.
 */

export const revalidate = 15;

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const TITULOS: Record<string, string> = {
  [KdsStatus.PENDING]: "Pendiente",
  [KdsStatus.PREPARING]: "En preparación",
  [KdsStatus.READY]: "Listo",
};

const SIGUIENTE: Record<string, string> = {
  [KdsStatus.PENDING]: "Empezar",
  [KdsStatus.PREPARING]: "Marcar listo",
  [KdsStatus.READY]: "Entregado",
};

const COLOR_DEMORA: Record<string, string> = {
  normal: "border-slate-200 bg-white",
  atencion: "border-amber-300 bg-amber-50",
  urgente: "border-destructive/40 bg-destructive/10",
};

type CocinaPageProps = {
  searchParams: Promise<{ branchId?: string | string[] }>;
};

export default async function CocinaPage({ searchParams }: CocinaPageProps) {
  const { session } = await requireModule(AppModule.KITCHEN);
  const params = await searchParams;

  const sucursales = await getBranchesForManagement(session.user.businessId);
  const branchId = uno(params.branchId) || sucursales[0]?.id || "";
  const renglones = branchId ? await findRenglonesDeCocina(session.user.businessId, branchId) : [];

  const ahora = Date.now();

  return (
    <AppShell maxWidth="lg">
      <PageHeader
        title="Cocina"
        description="Qué preparar y en qué orden. Se actualiza sola."
        actions={
          sucursales.length > 1 ? (
            <form className="flex items-end gap-2">
              <Field label="Sucursal">
                <select className={selectClass} defaultValue={branchId} name="branchId">
                  {sucursales.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <GhostButton>Ver</GhostButton>
            </form>
          ) : null
        }
      />

      {renglones.length === 0 ? (
        <EmptyState title="No hay nada para preparar" hint="Lo que el mozo cargue en el salón aparece acá." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {COLUMNAS_COCINA.map((columna) => {
            const dela = renglones.filter((r) => r.kdsStatus === columna);

            return (
              <section className="flex flex-col gap-3" key={columna}>
                <h2 className="flex items-baseline gap-2 text-lg font-black tracking-tight text-slate-950">
                  {TITULOS[columna]}
                  <span className="text-sm font-bold text-slate-400">{dela.length}</span>
                </h2>

                {dela.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                    Nada acá
                  </p>
                ) : (
                  dela.map((r) => {
                    const espera = textoDeEspera(r.sentToKitchenAt.getTime(), ahora);
                    const minutos = Math.floor((ahora - r.sentToKitchenAt.getTime()) / 60000);
                    const nivel = nivelDeDemora(minutos, r.product?.prepMinutes ?? null);

                    return (
                      <article className={`rounded-2xl border p-4 ${COLOR_DEMORA[nivel]}`} key={r.id}>
                        <div className="flex items-start justify-between gap-2">
                          {/* La MESA arriba y grande: es lo que el cocinero
                              canta cuando el plato sale. */}
                          <p className="text-base font-black tracking-tight text-slate-950">
                            {r.order.table?.name ?? `Comanda #${r.order.number}`}
                          </p>
                          <span
                            className={`shrink-0 font-mono text-sm font-bold tabular-nums ${
                              nivel === "urgente" ? "text-destructive" : "text-slate-500"
                            }`}
                          >
                            {espera}
                          </span>
                        </div>

                        <p className="mt-2 text-lg font-bold leading-tight text-slate-950">
                          {formatQuantity(r.quantity)} × {r.description}
                        </p>
                        {r.note ? (
                          <p className="mt-1 rounded-lg bg-white/70 px-2 py-1 text-sm font-semibold italic text-slate-700">
                            {r.note}
                          </p>
                        ) : null}

                        <form action={avanzarAction} className="mt-3">
                          <input name="itemId" type="hidden" value={r.id} />
                          <input name="branchId" type="hidden" value={branchId} />
                          <button
                            className="h-12 w-full rounded-full bg-primary text-base font-black text-primary-foreground transition hover:bg-primary-strong active:scale-[0.99]"
                            type="submit"
                          >
                            {SIGUIENTE[columna]}
                          </button>
                        </form>
                      </article>
                    );
                  })
                )}
              </section>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
