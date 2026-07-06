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

export type DashboardRangeInput = {
  range?: DashboardRangeKey;
  from?: Date;
  to?: Date;
};

export type ResolvedDashboardRange = {
  key: DashboardRangeKey;
  from: Date;
  to: Date;
};

// Resuelve un rango (preset o personalizado) a fechas concretas [from, to].
// Fuente única compartida por el dashboard y los reportes.
export function resolveDashboardRange(now: Date, input?: DashboardRangeInput): ResolvedDashboardRange {
  const key = input?.range ?? DashboardRange.Today;
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (key) {
    case DashboardRange.Custom: {
      const from = startOfDay(input?.from ?? now);
      const requestedTo = input?.to ? endOfDay(input.to) : now;
      const to = requestedTo < from ? endOfDay(from) : requestedTo;

      return { key, from, to };
    }

    case DashboardRange.Last7Days:
      return { key, from: startOfDay(addDays(now, -6)), to: now };

    case DashboardRange.Last14Days:
      return { key, from: startOfDay(addDays(now, -13)), to: now };

    case DashboardRange.ThisMonth:
      return { key, from: new Date(year, month, 1), to: now };

    case DashboardRange.LastMonth:
      return { key, from: new Date(year, month - 1, 1), to: endOfDay(new Date(year, month, 0)) };

    case DashboardRange.ThisQuarter:
      return { key, from: new Date(year, Math.floor(month / 3) * 3, 1), to: now };

    case DashboardRange.ThisSemester:
      return { key, from: new Date(year, month < 6 ? 0 : 6, 1), to: now };

    case DashboardRange.ThisYear:
      return { key, from: new Date(year, 0, 1), to: now };

    default:
      return { key: DashboardRange.Today, from: startOfDay(now), to: now };
  }
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);

  return result;
}
