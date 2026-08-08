import { AppShell, PageHeader } from "@/components/app-shell";
import { PeriodFade } from "@/components/period-fade";
import { StatTiles } from "@/components/stat-tiles";
import {
  Badge,
  EmptyState,
  formatMoney,
  GhostButton,
  SectionCard,
  TableWrap,
} from "@/components/manager-ui";
import { MoneyInput } from "@/components/money-input";
import { RefreshActionForm } from "@/components/refresh-action-form";
import { AppModule } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/payment-labels";
import { getCommissionSummary } from "@/modules/staff/commissions.use-case";
import Link from "next/link";

import { payCommissionAction } from "./actions";

const monthFormatter = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" });

type ComisionesPageProps = {
  searchParams: Promise<{ month?: string | string[]; status?: string | string[]; message?: string | string[] }>;
};

export default async function ComisionesPage({ searchParams }: ComisionesPageProps) {
  const { business } = await requireModule(AppModule.STAFF_COMMISSIONS);

  const params = await searchParams;
  const now = new Date();
  const monthKey = getMonthKey(single(params.month), now);
  const [year, month] = monthKey.split("-").map(Number);

  // El período es el mes completo: es como se liquida en un comercio.
  const from = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const to = new Date(year, month, 0, 23, 59, 59, 999);

  const summary = await getCommissionSummary({ businessId: business.id, period: { from, to } });

  const withRate = summary.rows.filter((row) => row.commissionRate > 0);

  return (
    <AppShell maxWidth="lg">
      <PageHeader
        eyebrow="Bills"
        title="Comisiones"
        description={`Lo que le toca a cada ${business.labels.staffSingular.toLowerCase()} por lo que vendió, sobre el total cobrado.`}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Link
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600"
          href={`/comisiones?month=${shiftMonth(monthKey, -1)}`}
        >
          ← Mes anterior
        </Link>
        <span className="text-sm font-black capitalize text-slate-950">{monthFormatter.format(from)}</span>
        <Link
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600"
          href={`/comisiones?month=${shiftMonth(monthKey, 1)}`}
        >
          Mes siguiente →
        </Link>
      </div>

      <StatTiles
        tiles={[
          { label: "Vendido en el mes", value: formatMoney(summary.totalSold), amount: summary.totalSold, kind: "money" },
          {
            label: "Comisiones",
            value: formatMoney(summary.totalCommission),
            amount: summary.totalCommission,
            kind: "money",
            hint: "A pagar",
            tone: summary.totalCommission > 0 ? "warning" : "neutral",
          },
          { label: "Con comisión", value: `${withRate.length} de ${summary.rows.length}` },
        ]}
      />

      <SectionCard
        title="Liquidación del mes"
        description="Se cuenta solo lo cobrado en ventas completadas: una venta anulada no genera comisión."
      >
        <PeriodFade period={`month-${monthKey}`}>
        {summary.rows.length === 0 ? (
          <EmptyState
            title="No hay empleados activos."
            hint="Cargá tu equipo para poder liquidar comisiones."
          />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[38rem] border-collapse text-sm">
              <thead>
                <tr className="text-left text-[0.68rem] uppercase tracking-wider text-slate-400">
                  <th className="pb-2 font-bold">{business.labels.staffSingular}</th>
                  <th className="pb-2 font-bold">Ventas</th>
                  <th className="pb-2 font-bold">Vendió</th>
                  <th className="pb-2 font-bold">%</th>
                  <th className="pb-2 font-bold">Comisión</th>
                  <th className="pb-2 font-bold" />
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((row) => (
                  <tr className="border-t border-slate-100" key={row.staffId}>
                    <td className="py-2.5 pr-3 font-bold text-slate-950">{row.name}</td>
                    <td className="py-2.5 pr-3 text-slate-500">{row.sales}</td>
                    <td className="py-2.5 pr-3 font-semibold text-slate-800">{formatMoney(row.sold)}</td>
                    <td className="py-2.5 pr-3">
                      {row.commissionRate > 0 ? (
                        <Badge tone="info">{row.commissionRate}%</Badge>
                      ) : (
                        <span className="text-xs text-slate-400">sin comisión</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 font-black text-slate-950">{formatMoney(row.commission)}</td>
                    <td className="py-2.5">
                      {row.commission > 0 ? (
                        <RefreshActionForm action={payCommissionAction} className="flex flex-wrap items-center gap-1.5">
                          <input name="staffId" type="hidden" value={row.staffId} />
                          <input name="month" type="hidden" value={monthKey} />
                          <input name="from" type="hidden" value={toISODate(from)} />
                          <input name="to" type="hidden" value={toISODate(to)} />
                          <MoneyInput
                            aria-label={`Importe a pagar a ${row.name}`}
                            className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold"
                            defaultValue={row.commission}
                            name="amount"
                          />
                          <select
                            aria-label="Cuenta"
                            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold"
                            name="method"
                          >
                            {PAYMENT_METHOD_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <GhostButton>Pagar</GhostButton>
                        </RefreshActionForm>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}

        <p className="mt-4 text-xs text-slate-400">
          El porcentaje de cada uno se configura en {business.labels.staffPlural}. Al pagar, queda registrado como
          gasto de sueldos y sale de la cuenta que elijas.
        </p>
        </PeriodFade>
      </SectionCard>
    </AppShell>
  );
}

function single(value: string | string[] | undefined) {
  const one = Array.isArray(value) ? value[0] : value;
  return one === "" ? undefined : one;
}

function getMonthKey(value: string | undefined, now: Date) {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    return value;
  }
  return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}`;
}

function shiftMonth(monthKey: string, delta: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`;
}

function toISODate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
