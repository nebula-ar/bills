import { AppShell, PageHeader } from "@/components/app-shell";
import { RefreshActionForm } from "@/components/refresh-action-form";
import { Badge, Field, GhostButton, PrimaryButton, SectionCard, selectClass } from "@/components/manager-ui";
import { CONFIGURABLE_MODULES, MODULE_INFO } from "@/lib/app-modules";
import { requireBusinessContext } from "@/lib/business-context";
import { verticalPreset, VERTICAL_ORDER, VERTICAL_PRESETS } from "@/lib/vertical";
import { ModuleIcon } from "@/components/module-icon";

import { changeVerticalAction, toggleModuleAction } from "./actions";

const TINTS: Record<string, string> = {
  emerald: "bg-emerald-500 text-white",
  blue: "bg-primary text-white",
  violet: "bg-violet-500 text-white",
  orange: "bg-orange-500 text-white",
  rose: "bg-rose-500 text-white",
  cyan: "bg-cyan-500 text-white",
  amber: "bg-amber-500 text-white",
  indigo: "bg-indigo-500 text-white",
};

type SettingsPageProps = {
  searchParams: Promise<{ status?: string | string[]; message?: string | string[] }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const { business } = await requireBusinessContext();
  await searchParams;

  const preset = verticalPreset(business.vertical);

  return (
    <AppShell maxWidth="lg">
      <PageHeader
        eyebrow="Bills"
        title="Módulos"
        description="Prendé solo lo que tu negocio usa. Lo que apagás desaparece del menú, pero no se borra."
      />

      <SectionCard
        title="Tu rubro"
        description={`Hoy es «${preset.label}». El rubro define cómo se llaman las cosas: tu catálogo se muestra como «${business.labels.catalogPlural}» y quien atiende como «${business.labels.staffSingular}».`}
      >
        <RefreshActionForm action={changeVerticalAction} className="grid gap-3 sm:grid-cols-2">
          <Field label="Cambiar rubro">
            <select className={selectClass} defaultValue={business.vertical} name="vertical">
              {VERTICAL_ORDER.map((vertical) => (
                <option key={vertical} value={vertical}>
                  {VERTICAL_PRESETS[vertical].label}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input defaultChecked name="applyPresetModules" type="checkbox" />
              Prender los módulos típicos del rubro nuevo
            </label>
            <PrimaryButton className="self-start">Guardar rubro</PrimaryButton>
          </div>
        </RefreshActionForm>
        <p className="mt-3 text-xs text-slate-500">
          Cambiar de rubro no toca tus datos: el catálogo, las ventas y el stock quedan tal cual.
        </p>
      </SectionCard>

      <SectionCard title="Módulos del sistema" description="Ventas, historial y reportes están siempre activos.">
        <ul className="space-y-2.5">
          {CONFIGURABLE_MODULES.map((module) => {
            const info = MODULE_INFO[module];
            const enabled = business.has(module);
            const suggested = preset.modules.includes(module);

            return (
              <li
                className={`flex items-center gap-3 rounded-2xl border p-3.5 ${
                  enabled ? "border-primary/20 bg-primary/10/40" : "border-slate-200 bg-white"
                }`}
                key={module}
              >
                <span
                  className={`flex size-11 shrink-0 items-center justify-center rounded-lg shadow-sm ${
                    enabled ? TINTS[info.tint] : "bg-slate-200 text-slate-500"
                  }`}
                >
                  <ModuleIcon name={info.icon} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-black text-slate-950">{info.label}</p>
                    {suggested && !enabled ? <Badge tone="info">Recomendado para tu rubro</Badge> : null}
                  </div>
                  <p className="text-xs text-slate-500">{info.hint}</p>
                </div>
                <RefreshActionForm action={toggleModuleAction} className="shrink-0">
                  <input name="module" type="hidden" value={module} />
                  <input name="enabled" type="hidden" value={String(!enabled)} />
                  {enabled ? <GhostButton>Apagar</GhostButton> : <PrimaryButton className="px-3 py-2 text-xs">Prender</PrimaryButton>}
                </RefreshActionForm>
              </li>
            );
          })}
        </ul>
      </SectionCard>
    </AppShell>
  );
}
