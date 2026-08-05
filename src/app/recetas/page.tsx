import { AppShell, PageHeader } from "@/components/app-shell";
import {
  Badge,
  EmptyState,
  Field,
  formatMoney,
  GhostButton,
  inputClass,
  SectionCard,
  selectClass,
} from "@/components/manager-ui";
import { AppModule, Unit } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { formatQuantity, unitShort } from "@/lib/quantity";
import { getBranchesForManagement } from "@/modules/branches/get-branches-for-management.use-case";
import { costoDeReceta } from "@/modules/tables/recipes";
import { findElaborables, findInsumos } from "@/modules/tables/recipes.repository";

import { crearInsumoAction, ponerEnRecetaAction, sacarDeRecetaAction } from "./actions";

/**
 * Insumos y recetas: cuánto cuesta de verdad cada budín.
 *
 * La receta se carga una vez. Cuando sube la harina, el costo de todo lo que
 * la lleva se recalcula solo, porque sale del costo del insumo y no de un
 * número escrito a mano que nadie vuelve a tocar.
 */

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

type RecetasPageProps = {
  searchParams: Promise<{
    branchId?: string | string[];
    producto?: string | string[];
    estado?: string | string[];
    mensaje?: string | string[];
  }>;
};

export default async function RecetasPage({ searchParams }: RecetasPageProps) {
  const { session } = await requireModule(AppModule.RECIPES);
  const params = await searchParams;

  const sucursales = await getBranchesForManagement(session.user.businessId);
  const branchId = uno(params.branchId) || sucursales[0]?.id || "";

  const [insumos, elaborables] = await Promise.all([
    findInsumos(session.user.businessId, branchId),
    findElaborables(session.user.businessId),
  ]);

  const productoPedido = uno(params.producto);
  const producto = elaborables.find((p) => p.id === productoPedido) ?? elaborables[0];

  const receta = (producto?.receta ?? []).map((r) => ({
    ingredienteId: r.ingredient.id,
    cantidad: r.quantity,
    costoPorUnidad: r.ingredient.cost,
  }));
  const costo = costoDeReceta(receta);

  const mensaje = uno(params.mensaje);
  const estado = uno(params.estado);

  return (
    <AppShell>
      <PageHeader
        title="Recetas"
        description="Qué insumo lleva cada producto, y cuánto cuesta hacerlo."
      />

      {mensaje ? (
        <p
          className={`rounded-xl px-4 py-3 text-sm font-semibold ${
            estado === "error" ? "bg-destructive/10 text-destructive" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {mensaje}
        </p>
      ) : null}

      <SectionCard title="Insumos" description="Lo que se compra y se consume. No se vende.">
        {insumos.length === 0 ? (
          <EmptyState title="Todavía no hay insumos" hint="Cargá harina, manteca, azúcar… acá abajo." />
        ) : (
          <ul className="mb-4 flex flex-col gap-2">
            {insumos.map((i) => {
              const stock = i.stockLevels[0]?.quantity ?? 0;
              const bajo = i.minStock !== null && stock < i.minStock;

              return (
                <li className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3" key={i.id}>
                  <span className="flex-1 text-sm font-bold text-slate-950">{i.name}</span>
                  <span className="text-sm text-slate-600">
                    {formatQuantity(stock)} {unitShort(i.unit)}
                  </span>
                  {i.cost ? (
                    <span className="text-sm font-semibold text-slate-500">
                      {formatMoney(i.cost)}/{unitShort(i.unit)}
                    </span>
                  ) : (
                    <Badge tone="warning">sin costo</Badge>
                  )}
                  {bajo ? <Badge tone="danger">falta</Badge> : null}
                </li>
              );
            })}
          </ul>
        )}

        <form action={crearInsumoAction} className="flex flex-wrap items-end gap-2">
          <Field label="Insumo nuevo">
            <input className={inputClass} name="name" placeholder="Ej: Harina 000" required />
          </Field>
          <Field label="Unidad">
            <select className={selectClass} defaultValue={Unit.KG} name="unit">
              {Object.values(Unit).map((u) => (
                <option key={u} value={u}>
                  {unitShort(u)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Costo por unidad">
            <input className={inputClass} inputMode="numeric" name="cost" placeholder="2000" />
          </Field>
          <Field label="Avisar bajo">
            <input className={inputClass} inputMode="decimal" name="minStock" placeholder="5" />
          </Field>
          <GhostButton>Agregar insumo</GhostButton>
        </form>
      </SectionCard>

      {elaborables.length === 0 ? null : (
        <SectionCard
          title="Receta"
          description={
            producto
              ? `${producto.name} · cuesta ${formatMoney(costo)} hacer uno`
              : "Elegí un producto"
          }
        >
          <div className="mb-4 flex flex-wrap gap-2">
            {elaborables.map((p) => (
              <a
                className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${
                  p.id === producto?.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
                href={`/recetas?producto=${p.id}`}
                key={p.id}
              >
                {p.name}
                {p.receta.length > 0 ? " ✓" : ""}
              </a>
            ))}
          </div>

          {producto ? (
            <div className="flex flex-col gap-4">
              {producto.receta.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                  {producto.name} todavía no tiene receta. Agregale insumos abajo.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {producto.receta.map((r) => (
                    <li className="flex items-center gap-3 rounded-xl bg-slate-50 p-3" key={r.id}>
                      <span className="flex-1 text-sm font-bold text-slate-950">{r.ingredient.name}</span>
                      <span className="text-sm text-slate-600">
                        {formatQuantity(r.quantity)} {unitShort(r.ingredient.unit)}
                      </span>
                      <span className="text-sm font-semibold text-slate-500">
                        {r.ingredient.cost
                          ? formatMoney(Math.round((r.ingredient.cost * r.quantity) / 1000))
                          : "—"}
                      </span>
                      <form action={sacarDeRecetaAction}>
                        <input name="recipeItemId" type="hidden" value={r.id} />
                        <input name="productId" type="hidden" value={producto.id} />
                        <button
                          aria-label={`Quitar ${r.ingredient.name}`}
                          className="grid size-7 place-items-center rounded-full text-slate-400 transition hover:bg-destructive/10 hover:text-destructive"
                          type="submit"
                        >
                          ×
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}

              {insumos.length > 0 ? (
                <form action={ponerEnRecetaAction} className="flex flex-wrap items-end gap-2">
                  <input name="productId" type="hidden" value={producto.id} />
                  <Field label="Insumo">
                    <select className={selectClass} name="ingredientId">
                      {insumos.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({unitShort(i.unit)})
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Cuánto lleva UNO">
                    <input className={inputClass} inputMode="decimal" name="quantity" placeholder="0,12" required />
                  </Field>
                  <GhostButton>Poner en la receta</GhostButton>
                </form>
              ) : null}
            </div>
          ) : null}
        </SectionCard>
      )}
    </AppShell>
  );
}
