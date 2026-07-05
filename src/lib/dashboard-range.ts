// Rangos de período del dashboard, compartidos entre el use-case (server), la
// página y el componente mobile (client). Se centralizan las keys para no
// acoplar los módulos con strings sueltos.
export const DashboardRange = {
  Today: "today",
  Last7Days: "7d",
  Last14Days: "14d",
  ThisMonth: "month",
  LastMonth: "last-month",
  ThisQuarter: "quarter",
  ThisSemester: "semester",
  ThisYear: "year",
  Custom: "custom",
} as const;

export type DashboardRangeKey = (typeof DashboardRange)[keyof typeof DashboardRange];

export const DASHBOARD_RANGE_LABELS: Record<DashboardRangeKey, string> = {
  [DashboardRange.Today]: "Hoy",
  [DashboardRange.Last7Days]: "Últimos 7 días",
  [DashboardRange.Last14Days]: "Últimos 14 días",
  [DashboardRange.ThisMonth]: "Este mes",
  [DashboardRange.LastMonth]: "Mes pasado",
  [DashboardRange.ThisQuarter]: "Este trimestre",
  [DashboardRange.ThisSemester]: "Este semestre",
  [DashboardRange.ThisYear]: "Este año",
  [DashboardRange.Custom]: "Personalizado",
};

const KNOWN_RANGES = new Set<string>(Object.values(DashboardRange));

export function parseDashboardRange(value: string | string[] | undefined | null): DashboardRangeKey {
  const raw = Array.isArray(value) ? value[0] : value;

  if (raw && KNOWN_RANGES.has(raw)) {
    return raw as DashboardRangeKey;
  }

  return DashboardRange.Today;
}
