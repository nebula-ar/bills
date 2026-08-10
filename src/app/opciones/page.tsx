import { AppShell, PageHeader } from "@/components/app-shell";
import { SelectField } from "@/components/ui/select-field";
import {
  Badge,
  EmptyState,
  Field,
  formatMoney,
  GhostButton,
  inputClass,
  PrimaryButton,
  SectionCard,
  selectClass,
} from "@/components/manager-ui";
import { AppModule } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import {
  findGruposConModificadores,
  findProductosParaAsignar,
} from "@/modules/catalog/modifiers.repository";

import {
  asignarProductosAction,
  borrarGrupoAction,
  borrarModificadorAction,
  crearGrupoAction,
  crearModificadorAction,
} from "./actions";

/**
 * Opciones de producto: "con leche descremada", "sin azúcar", "extra jamón".
 *
 * Es el módulo que cobra lo que hoy se regala. Un grupo agrupa opciones
 * excluyentes o combinables, y se le ofrece a los productos que lo necesiten:
 * la leche solo al café, los agregados solo a los sándwiches.
 */

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

type OpcionesPageProps = {
  searchParams: Promise<{ estado?: string | string[]; mensaje?: string | string[] }>;
};

export default async function OpcionesPage({ searchParams }: OpcionesPageProps) {
  const { session } = await requireModule(AppModule.TABLES);
  const params = await searchParams;

  const [grupos, productos] = await Promise.all([
    findGruposConModificadores(session.user.businessId),
    findProductosParaAsignar(session.user.businessId),
  ]);

  const mensaje = uno(params.mensaje);
  const estado = uno(params.estado);

  return (
    <AppShell>
      <PageHeader
        title="Opciones"
        description="Los extras que hoy se regalan: leche de almendras, agregados, cambios."
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

      {grupos.length === 0 ? (
        <EmptyState
          title="Todavía no hay opciones"
          hint='Creá un grupo abajo. Por ejemplo "Tipo de leche" con entera, descremada y de almendras.'
        />
      ) : null}

      {grupos.map((grupo) => (
        <SectionCard
          key={grupo.id}
          title={grupo.name}
          description={
            grupo.maxSelect <= 1
              ? grupo.required
                ? "Elegí una · obligatorio"
                : "Elegí una"
              : `Hasta ${grupo.maxSelect}${grupo.minSelect > 0 ? ` · mínimo ${grupo.minSelect}` : ""}`
          }
        >
          <div className="flex flex-col gap-4">
            <ul className="flex flex-col gap-2">
              {grupo.modifiers.length === 0 ? (
                <li className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
                  Este grupo todavía no tiene opciones.
                </li>
              ) : (
                grupo.modifiers.map((m) => (
                  <li className="flex items-center gap-3 rounded-xl bg-slate-50 p-3" key={m.id}>
                    <span className="flex-1 text-sm font-bold text-slate-950">{m.name}</span>
                    <span
                      className={`text-sm font-black ${
                        m.priceDelta > 0 ? "text-primary" : m.priceDelta < 0 ? "text-destructive" : "text-slate-500"
                      }`}
                    >
                      {m.priceDelta === 0
                        ? "sin cargo"
                        : `${m.priceDelta > 0 ? "+" : "−"}${formatMoney(Math.abs(m.priceDelta))}`}
                    </span>
                    <form action={borrarModificadorAction}>
                      <input name="modifierId" type="hidden" value={m.id} />
                      <button
                        aria-label={`Eliminar ${m.name}`}
                        className="grid size-11 place-items-center rounded-full text-slate-600 transition hover:bg-destructive/10 hover:text-destructive"
                        type="submit"
                      >
                        ×
                      </button>
                    </form>
                  </li>
                ))
              )}
            </ul>

            <form action={crearModificadorAction} className="flex flex-wrap items-end gap-2">
              <input name="groupId" type="hidden" value={grupo.id} />
              <Field label="Opción nueva">
                <input className={inputClass} name="name" placeholder="Ej: De almendras" required />
              </Field>
              <Field label="Ajuste">
                <SelectField
                  ariaLabel="Ajuste"
                  name="signo"
                  options={[
                    { value: "+", label: "Suma" },
                    { value: "-", label: "Resta" },
                  ]}
                />
              </Field>
              <Field label="Monto">
                <input className={inputClass} defaultValue="0" inputMode="numeric" name="priceDelta" />
              </Field>
              <GhostButton>Agregar</GhostButton>
            </form>

            <form action={asignarProductosAction} className="flex flex-col gap-2">
              <input name="groupId" type="hidden" value={grupo.id} />
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                ¿A qué productos se les ofrece?
              </p>
              {/* La asignación es lo que hace segura la validación: un
                  modificador solo se puede elegir si su grupo está asignado a
                  ESE producto. Ver validarSeleccion. */}
              <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto">
                {productos.map((p) => {
                  const asignado = grupo.products.some((gp) => gp.id === p.id);
                  return (
                    <label
                      className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                        asignado
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                      key={p.id}
                    >
                      <input
                        className="sr-only"
                        defaultChecked={asignado}
                        name="productIds"
                        type="checkbox"
                        value={p.id}
                      />
                      {p.name}
                    </label>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <GhostButton>Guardar productos</GhostButton>
                <Badge tone={grupo.products.length ? "info" : "warning"}>
                  {grupo.products.length === 0
                    ? "Sin productos: no se ofrece en ningún lado"
                    : `${grupo.products.length} producto${grupo.products.length === 1 ? "" : "s"}`}
                </Badge>
              </div>
            </form>

            <form action={borrarGrupoAction}>
              <input name="groupId" type="hidden" value={grupo.id} />
              <button
                className="text-sm font-bold text-slate-500 transition hover:text-destructive"
                type="submit"
              >
                Eliminar el grupo «{grupo.name}»
              </button>
            </form>
          </div>
        </SectionCard>
      ))}

      <SectionCard
        title="Grupo nuevo"
        description="Un grupo junta opciones que se eligen juntas: el tipo de leche, los agregados."
      >
        <form action={crearGrupoAction} className="flex flex-wrap items-end gap-3">
          <Field label="Nombre">
            <input className={inputClass} maxLength={40} name="name" placeholder="Ej: Tipo de leche" required />
          </Field>
          <Field label="Máximo a elegir">
            <input className={inputClass} defaultValue={1} max={20} min={1} name="maxSelect" type="number" />
          </Field>
          <Field label="Mínimo">
            <input className={inputClass} defaultValue={0} min={0} name="minSelect" type="number" />
          </Field>
          <label className="flex items-center gap-2 pb-2 text-sm font-semibold text-slate-700">
            <input className="size-4" name="required" type="checkbox" />
            Obligatorio
          </label>
          <PrimaryButton>Crear grupo</PrimaryButton>
        </form>
      </SectionCard>
    </AppShell>
  );
}
