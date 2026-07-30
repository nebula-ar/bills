import { AppShell, PageHeader } from "@/components/app-shell";
import { ExportPanel } from "@/components/export-panel";
import { SectionCard } from "@/components/manager-ui";
import { requireBusinessContext } from "@/lib/business-context";
import { EXPORT_DATASETS } from "@/modules/reports/export.use-case";

export default async function ExportarPage() {
  await requireBusinessContext();

  // Por defecto, el mes pasado: es lo que se le manda al contador a principio de
  // mes, que es cuando alguien entra a esta pantalla.
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date(now.getFullYear(), now.getMonth(), 0);

  return (
    <AppShell maxWidth="lg">
      <PageHeader
        eyebrow="Bills"
        title="Exportar"
        description="Planillas para el contador. Se abren en Excel con las tildes y los importes bien."
      />

      <SectionCard title="Elegí el período" description="El día de fin entra completo.">
        <ExportPanel datasets={EXPORT_DATASETS} defaultFrom={toISODate(from)} defaultTo={toISODate(to)} />
      </SectionCard>
    </AppShell>
  );
}

function toISODate(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
