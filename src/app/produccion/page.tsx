import { AppShell, PageHeader } from "@/components/app-shell";
import { SelectField } from "@/components/ui/select-field";
import {
  EmptyState,
  Field,
  formatMoney,
  inputClass,
  PrimaryButton,
  SectionCard,
  selectClass,
} from "@/components/manager-ui";
import { AppModule } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { formatQuantity, unitShort } from "@/lib/quantity";
import { getBranchesForManagement } from "@/modules/branches/get-branches-for-management.use-case";
import { costoDeReceta } from "@/modules/tables/recipes";
import { findElaborables } from "@/modules/tables/recipes.repository";

import { producirAction } from "../recetas/actions";

/**
 * Registrar una tanda.
 *
 * Suma lo producido al stock y descuenta los insumos que consumió, todo junto:
 * una producción a medias deja el stock mintiendo, y un stock que miente es
 * peor que no tener stock.
 */

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

type ProduccionPageProps = {
  searchParams: Promise<{
    branchId?: string | string[];
    estado?: string | string[];
    mensaje?: string | string[];
  }>;
};

export default async function ProduccionPage({ searchParams }: ProduccionPageProps) {
  const { session } = await requireModule(AppModule.RECIPES);
  const params = await searchParams;

  const sucursales = await getBranchesForManagement(session.user.businessId);
  const branchId = uno(params.branchId) || sucursales[0]?.id || "";
  const elaborables = await findElaborables(session.user.businessId);
  const conReceta = elaborables.filter((p) => p.receta.length > 0);

  const mensaje = uno(params.mensaje);
  const estado = uno(params.estado);

  return (
    <AppShell>
      <PageHeader title="Producción" description="Registrás la tanda y se descuentan los insumos." />

      {mensaje ? (
        <p
          className={`rounded-xl px-4 py-3 text-sm font-semibold ${
            estado === "error" ? "bg-destructive/10 text-destructive" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {mensaje}
        </p>
      ) : null}

      {conReceta.length === 0 ? (
        <EmptyState
          title="Ningún producto tiene receta todavía"
          hint="Cargá las recetas primero: sin receta no hay insumos que descontar."
        />
      ) : (
        <>
          <SectionCard title="Registrar una tanda" description="Lo que saliste a hacer hoy.">
            <form action={producirAction} className="flex flex-wrap items-end gap-3">
              <input name="branchId" type="hidden" value={branchId} />
              <Field label="Qué se hizo">
                <SelectField
                  ariaLabel="Qué se hizo"
                  name="productId"
                  options={conReceta.map((p) => ({ value: p.id, label: p.name }))}
                />
              </Field>
              <Field label="Cuántas unidades">
                <input className={inputClass} defaultValue={12} min={1} name="unidades" type="number" />
              </Field>
              <PrimaryButton>Registrar</PrimaryButton>
            </form>
          </SectionCard>

          <SectionCard title="Qué consume cada uno" description="Por unidad producida.">
            <div className="flex flex-col gap-4">
              {conReceta.map((p) => {
                const receta = p.receta.map((r) => ({
                  ingredienteId: r.ingredient.id,
                  cantidad: r.quantity,
                  costoPorUnidad: r.ingredient.cost,
                }));

                return (
                  <div key={p.id}>
                    <p className="mb-2 text-sm font-black text-slate-950">
                      {p.name}
                      <span className="ml-2 font-bold text-primary">{formatMoney(costoDeReceta(receta))}</span>
                      <span className="ml-1 text-xs font-semibold text-slate-500">por unidad</span>
                    </p>
                    <ul className="flex flex-wrap gap-2">
                      {p.receta.map((r) => (
                        <li
                          className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                          key={r.id}
                        >
                          {r.ingredient.name} {formatQuantity(r.quantity)} {unitShort(r.ingredient.unit)}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </>
      )}
    </AppShell>
  );
}
