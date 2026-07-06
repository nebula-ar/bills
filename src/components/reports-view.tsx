"use client";

import { AnimatedMoney, AnimatedNumber } from "@/components/animated-number";
import { SalesTrendChart } from "@/components/reports-charts";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { DASHBOARD_RANGE_LABELS, DashboardRange, type DashboardRangeKey } from "@/lib/dashboard-range";
import { ArrowUpRight, Calendar, CreditCard, ReceiptText, SlidersHorizontal, Ticket, TrendingUp, Users, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ComponentType, type ReactNode } from "react";

export type ReportsBarberOption = { id: string; name: string };
export type ReportsPaymentOption = { value: string; label: string };

export type ReportsData = {
  range: {
    key: DashboardRangeKey;
    label: string;
    isToday: boolean;
    dateLabel: string;
    fromValue: string;
    toValue: string;
  };
  totalSold: number;
  saleCount: number;
  averageTicket: number;
  salesTrend: { label: string; total: number }[];
  totalsByBarber: { barberId: string; barberName: string; total: number; saleCount: number }[];
  totalsByPayment: { key: string; label: string; total: number; percentage: number }[];
  latestSales: {
    id: string;
    timeLabel: string;
    barberName: string;
    branchName: string;
    total: number;
    paymentLabel: string;
    itemSummary: string;
  }[];
  activeFilters: {
    barberId?: string;
    barberName?: string;
    paymentMethod?: string;
    paymentLabel?: string;
  };
  barberOptions: ReportsBarberOption[];
  paymentOptions: ReportsPaymentOption[];
};

const QUICK_CHIPS: DashboardRangeKey[] = [DashboardRange.Today, DashboardRange.Last7Days, DashboardRange.Last14Days];
const CHIP_LABELS: Partial<Record<DashboardRangeKey, string>> = {
  [DashboardRange.Today]: "Hoy",
  [DashboardRange.Last7Days]: "7d",
  [DashboardRange.Last14Days]: "14d",
};
const SHEET_PRESETS: DashboardRangeKey[] = [
  DashboardRange.Today,
  DashboardRange.Last7Days,
  DashboardRange.Last14Days,
  DashboardRange.ThisMonth,
  DashboardRange.LastMonth,
  DashboardRange.ThisQuarter,
  DashboardRange.ThisSemester,
  DashboardRange.ThisYear,
  DashboardRange.Custom,
];

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

type FilterQuery = {
  range: DashboardRangeKey;
  from?: string;
  to?: string;
  barberId?: string;
  paymentMethod?: string;
};

function buildHref(query: FilterQuery) {
  const params = new URLSearchParams();
  params.set("range", query.range);
  if (query.range === DashboardRange.Custom) {
    if (query.from) params.set("from", query.from);
    if (query.to) params.set("to", query.to);
  }
  if (query.barberId) params.set("barberId", query.barberId);
  if (query.paymentMethod) params.set("paymentMethod", query.paymentMethod);

  return `/reports?${params.toString()}`;
}

export function ReportsView({ data }: { data: ReportsData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [rangeKey, setRangeKey] = useState<DashboardRangeKey>(data.range.key);
  const [customFrom, setCustomFrom] = useState(data.range.fromValue);
  const [customTo, setCustomTo] = useState(data.range.toValue);
  const [barberId, setBarberId] = useState(data.activeFilters.barberId ?? "");
  const [paymentMethod, setPaymentMethod] = useState(data.activeFilters.paymentMethod ?? "");

  const maxBarberTotal = Math.max(...data.totalsByBarber.map((b) => b.total), 0);
  const maxPaymentTotal = Math.max(...data.totalsByPayment.map((p) => p.total), 0);
  const heroLabel = data.range.isToday ? "Ventas de hoy" : data.range.label;
  const activeFilterCount = (data.activeFilters.barberId ? 1 : 0) + (data.activeFilters.paymentMethod ? 1 : 0);

  function navigate(href: string) {
    startTransition(() => router.push(href, { scroll: false }));
  }

  function openSheet() {
    setRangeKey(data.range.key);
    setCustomFrom(data.range.fromValue);
    setCustomTo(data.range.toValue);
    setBarberId(data.activeFilters.barberId ?? "");
    setPaymentMethod(data.activeFilters.paymentMethod ?? "");
    setSheetOpen(true);
  }

  function quickRange(key: DashboardRangeKey) {
    navigate(
      buildHref({
        range: key,
        barberId: data.activeFilters.barberId,
        paymentMethod: data.activeFilters.paymentMethod,
      }),
    );
  }

  function applyFilters() {
    setSheetOpen(false);
    navigate(buildHref({ range: rangeKey, from: customFrom, to: customTo, barberId, paymentMethod }));
  }

  function clearFilters() {
    setSheetOpen(false);
    navigate(`/reports?range=${DashboardRange.Today}`);
  }

  const customInvalid = rangeKey === DashboardRange.Custom && (!customFrom || !customTo || customFrom > customTo);

  return (
    <main className="mx-auto min-h-screen w-full min-w-0 max-w-[560px] overflow-x-clip bg-[#f6f7fb] px-4 pb-28 pt-6 text-slate-950">
      {/* Header */}
      <header className="flex items-start justify-between gap-4 duration-500 animate-in fade-in slide-in-from-top-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">Análisis de ventas</p>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight text-slate-950">Reportes</h1>
        </div>
        <Link
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-950/5 transition active:scale-95"
          href="/sales"
          aria-label="Ir a ventas"
        >
          <ReceiptText className="size-5" />
        </Link>
      </header>

      {/* Chips de período + filtros */}
      <div className="mt-5 flex items-center gap-2 duration-500 animate-in fade-in slide-in-from-bottom-2">
        <div className="-mx-1 flex flex-1 items-center gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {!QUICK_CHIPS.includes(data.range.key) ? (
            <button
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm shadow-blue-600/25 transition active:scale-95"
              onClick={openSheet}
              type="button"
            >
              {data.range.label}
              <SlidersHorizontal className="size-3.5" />
            </button>
          ) : null}
          {QUICK_CHIPS.map((key) => {
            const active = data.range.key === key;
            return (
              <button
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition active:scale-95 ${
                  active ? "bg-blue-600 text-white shadow-sm shadow-blue-600/25" : "bg-white text-slate-600 ring-1 ring-slate-950/5"
                }`}
                key={key}
                onClick={() => quickRange(key)}
                type="button"
              >
                {CHIP_LABELS[key]}
              </button>
            );
          })}
        </div>
        <button
          aria-label="Filtros"
          className={`relative flex size-10 shrink-0 items-center justify-center rounded-full transition active:scale-95 ${
            activeFilterCount > 0 || !QUICK_CHIPS.includes(data.range.key)
              ? "bg-blue-600 text-white shadow-sm shadow-blue-600/25"
              : "bg-white text-slate-600 ring-1 ring-slate-950/5"
          }`}
          onClick={openSheet}
          type="button"
        >
          <SlidersHorizontal className="size-4" />
          {activeFilterCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[0.6rem] font-black text-white ring-2 ring-[#f6f7fb]">
              {activeFilterCount}
            </span>
          ) : null}
        </button>
      </div>

      {/* Chips de filtros activos (barbero / método) */}
      {data.activeFilters.barberId || data.activeFilters.paymentMethod ? (
        <div className="mt-3 flex flex-wrap gap-2 duration-500 animate-in fade-in">
          {data.activeFilters.barberName ? (
            <FilterPill
              icon={Users}
              label={data.activeFilters.barberName}
              onClear={() =>
                navigate(buildHref({ range: data.range.key, from: customFrom, to: customTo, paymentMethod: data.activeFilters.paymentMethod }))
              }
            />
          ) : null}
          {data.activeFilters.paymentLabel ? (
            <FilterPill
              icon={CreditCard}
              label={data.activeFilters.paymentLabel}
              onClear={() =>
                navigate(buildHref({ range: data.range.key, from: customFrom, to: customTo, barberId: data.activeFilters.barberId }))
              }
            />
          ) : null}
        </div>
      ) : null}

      {/* Contenido (se atenúa mientras navega) */}
      <div className={isPending ? "pointer-events-none opacity-60 transition-opacity" : "transition-opacity"}>
        {/* Hero total */}
        <div
          className="relative mt-4 overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-600 p-6 text-white shadow-lg shadow-blue-600/25 duration-700 animate-in fade-in slide-in-from-bottom-3"
          style={{ animationDelay: "60ms", animationFillMode: "backwards" }}
        >
          <div className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-white/10 blur-xl" />
          <p className="text-sm font-medium text-blue-100">{heroLabel}</p>
          <AnimatedMoney className="mt-2 block text-[2.4rem] font-black leading-none tracking-tight" value={data.totalSold} />
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm font-medium text-blue-100">
            <span className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-white">
              <ReceiptText className="size-3.5" />
              {data.saleCount} ventas
            </span>
            <span className="truncate text-blue-100">{data.range.dateLabel}</span>
          </div>
        </div>

        {/* KPIs secundarios */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <StatCard icon={Ticket} label="Ticket promedio" delay={140}>
            <AnimatedMoney className="mt-2 block text-xl font-black tracking-tight text-slate-950" delayMs={140} value={data.averageTicket} />
          </StatCard>
          <StatCard icon={ReceiptText} label="Ventas" delay={200}>
            <AnimatedNumber className="mt-2 block text-xl font-black tracking-tight text-slate-950" delayMs={200} value={data.saleCount} />
          </StatCard>
        </div>

        {/* Tendencia */}
        {data.salesTrend.length >= 2 ? (
          <Panel delay={260} title="Ventas por día" icon={TrendingUp}>
            <SalesTrendChart data={data.salesTrend} />
          </Panel>
        ) : null}

        {/* Totales por barbero */}
        <Panel delay={320} title="Por barbero" icon={Users}>
          {data.totalsByBarber.length === 0 ? (
            <Empty>No hay ventas de barberos para estos filtros.</Empty>
          ) : (
            <div className="space-y-3.5">
              {data.totalsByBarber.map((barber, index) => (
                <div className="space-y-1.5" key={barber.barberId}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-black text-blue-700">
                        {index + 1}
                      </span>
                      <span className="truncate font-bold text-slate-700">{barber.barberName}</span>
                      <span className="shrink-0 text-xs text-slate-400">({barber.saleCount})</span>
                    </span>
                    <span className="shrink-0 font-black text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatMoney(barber.total)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-[width] duration-1000 ease-out"
                      style={{ width: `${maxBarberTotal > 0 ? Math.max((barber.total / maxBarberTotal) * 100, 6) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Métodos de pago */}
        <Panel delay={380} title="Métodos de pago" icon={CreditCard}>
          {data.totalsByPayment.length === 0 ? (
            <Empty>No hay pagos registrados para estos filtros.</Empty>
          ) : (
            <div className="space-y-3.5">
              {data.totalsByPayment.map((payment) => (
                <div className="space-y-1.5" key={payment.key}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-bold text-slate-700">{payment.label}</span>
                    <span className="shrink-0 font-black text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {payment.percentage}% · {formatMoney(payment.total)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-[width] duration-1000 ease-out"
                      style={{ width: `${maxPaymentTotal > 0 ? Math.max((payment.total / maxPaymentTotal) * 100, 6) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Últimas ventas */}
        <div className="mt-5 duration-500 animate-in fade-in slide-in-from-bottom-3" style={{ animationDelay: "440ms", animationFillMode: "backwards" }}>
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-black text-slate-950">Últimas ventas</h2>
            <Link className="flex items-center gap-0.5 text-xs font-bold text-blue-600" href="/sales">
              Ver todas
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
          <div className="mt-3 overflow-hidden rounded-[1.5rem] bg-white shadow-sm ring-1 ring-slate-950/5">
            {data.latestSales.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">No hay ventas para estos filtros.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.latestSales.map((sale) => (
                  <li className="flex items-center gap-3 px-4 py-3" key={sale.id}>
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                      <ReceiptText className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-950">{sale.barberName}</p>
                      <p className="truncate text-xs text-slate-500">
                        {sale.paymentLabel}
                        {sale.itemSummary ? ` · ${sale.itemSummary}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-black text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {formatMoney(sale.total)}
                      </p>
                      <p className="text-xs text-slate-400">{sale.timeLabel} hs</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Bottom sheet de filtros */}
      <BottomSheet onClose={() => setSheetOpen(false)} open={sheetOpen}>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between px-5 pt-6">
            <h3 className="text-xl font-black tracking-tight text-slate-950">Filtros</h3>
            <button
              aria-label="Cerrar"
              className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:scale-90"
              onClick={() => setSheetOpen(false)}
              type="button"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pt-5">
            {/* Período */}
            <section>
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                <Calendar className="size-4 text-blue-600" />
                Período
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SHEET_PRESETS.map((key) => {
                  const active = rangeKey === key;
                  return (
                    <button
                      className={`rounded-full px-3.5 py-2 text-sm font-bold transition active:scale-95 ${
                        active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                      }`}
                      key={key}
                      onClick={() => setRangeKey(key)}
                      type="button"
                    >
                      {DASHBOARD_RANGE_LABELS[key]}
                    </button>
                  );
                })}
              </div>
              {rangeKey === DashboardRange.Custom ? (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="grid gap-1.5 text-xs font-bold text-slate-500">
                    Desde
                    <input
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      max={customTo || undefined}
                      onChange={(event) => setCustomFrom(event.target.value)}
                      type="date"
                      value={customFrom}
                    />
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold text-slate-500">
                    Hasta
                    <input
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      min={customFrom || undefined}
                      onChange={(event) => setCustomTo(event.target.value)}
                      type="date"
                      value={customTo}
                    />
                  </label>
                </div>
              ) : null}
            </section>

            {/* Barbero */}
            <section>
              <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500" htmlFor="filter-barber">
                <Users className="size-4 text-blue-600" />
                Barbero
              </label>
              <select
                className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                id="filter-barber"
                onChange={(event) => setBarberId(event.target.value)}
                value={barberId}
              >
                <option value="">Todos los barberos</option>
                {data.barberOptions.map((barber) => (
                  <option key={barber.id} value={barber.id}>
                    {barber.name}
                  </option>
                ))}
              </select>
            </section>

            {/* Método de pago */}
            <section>
              <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500" htmlFor="filter-payment">
                <CreditCard className="size-4 text-blue-600" />
                Método de pago
              </label>
              <select
                className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                id="filter-payment"
                onChange={(event) => setPaymentMethod(event.target.value)}
                value={paymentMethod}
              >
                <option value="">Todos los métodos</option>
                {data.paymentOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </section>
          </div>

          {/* Footer */}
          <div className="mt-2 flex gap-3 border-t border-slate-100 px-5 pb-1 pt-4">
            <button
              className="rounded-2xl border border-slate-200 px-4 py-3.5 text-sm font-black text-slate-600 transition active:scale-95"
              onClick={clearFilters}
              type="button"
            >
              Limpiar
            </button>
            <button
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3.5 text-sm font-black text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.99] disabled:opacity-50"
              disabled={customInvalid || isPending}
              onClick={applyFilters}
              type="button"
            >
              Aplicar filtros
            </button>
          </div>
        </div>
      </BottomSheet>
    </main>
  );
}

function StatCard({
  icon: Icon,
  label,
  delay,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  delay: number;
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-950/5 duration-500 animate-in fade-in slide-in-from-bottom-2"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "backwards" }}
    >
      <p className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
        <Icon className="size-3.5 text-blue-600" />
        {label}
      </p>
      {children}
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  delay,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  delay: number;
  children: ReactNode;
}) {
  return (
    <div
      className="mt-5 rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-slate-950/5 duration-500 animate-in fade-in slide-in-from-bottom-3"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "backwards" }}
    >
      <h2 className="flex items-center gap-2 text-base font-black text-slate-950">
        <Icon className="size-4 text-blue-600" />
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function FilterPill({
  icon: Icon,
  label,
  onClear,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClear: () => void;
}) {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-blue-50 py-1.5 pl-3 pr-1.5 text-sm font-bold text-blue-700 ring-1 ring-blue-100">
      <Icon className="size-3.5" />
      <span className="max-w-[10rem] truncate">{label}</span>
      <button
        aria-label={`Quitar filtro ${label}`}
        className="flex size-5 items-center justify-center rounded-full bg-blue-100 text-blue-700 transition active:scale-90"
        onClick={onClear}
        type="button"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">{children}</p>;
}

