import { AppShell, PageHeader } from "@/components/app-shell";
import { ExportPanel } from "@/components/export-panel";
import { SectionCard } from "@/components/manager-ui";
import { requireBusinessContext } from "@/lib/business-context";
import { EXPORT_DATASETS } from "@/modules/reports/export.use-case";

export default async function ExportarPage() {
  await requireBusinessContext();

  // Por defecto, el mes en curso (del 1° a hoy): quien entra a exportar suele
  // haber vendido recién y espera ver esas ventas sin tocar el filtro. El mes
  // pasado se elige desde las fechas si hace falta mandárselo al contador.
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());

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
