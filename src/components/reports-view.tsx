"use client";

import { AnimatedMoney } from "@/components/animated-number";
import { PAYMENT_DONUT_COLORS } from "@/components/reports-charts-colors";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { DASHBOARD_RANGE_LABELS, DashboardRange, type DashboardRangeKey } from "@/lib/dashboard-range";
import { formatQuantity } from "@/lib/quantity";
import {
  ArrowRight,
  ArrowUpRight,
  Calendar,
  CalendarDays,
  CreditCard,
  LogOut,
  ReceiptText,
  Package,
  SlidersHorizontal,
  Store,
  Ticket,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "@/components/icons";
import { logoutAction } from "@/app/login/actions";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ComponentType, type ReactNode } from "react";

// Charts basados en recharts (dependencia grande): se cargan en el cliente, on
// demand, para no engordar el bundle inicial del dashboard.
const ChartSkeleton = () => <div className="h-[210px] w-full animate-pulse rounded-2xl bg-slate-100" />;
const SalesTrendChart = dynamic(
  () => import("@/components/reports-charts").then((mod) => mod.SalesTrendChart),
  { ssr: false, loading: ChartSkeleton },
);
const PaymentDonutChart = dynamic(
  () => import("@/components/reports-charts").then((mod) => mod.PaymentDonutChart),
  { ssr: false, loading: ChartSkeleton },
);

export type ReportsStaffOption = { id: string; name: string };
export type ReportsPaymentOption = { value: string; label: string };

export type ReportsData = {
  // true = el negocio todavía no cargó ningún producto/servicio.
  catalogEmpty: boolean;
  catalogPlural: string;
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
  itemsSold: number;
  // Gastos operativos: los que no dejan nada atrás. La mercadería no está acá.
  expensesTotal: number;
  // Ventas − costo de lo vendido − gastos operativos.
  profit: number;
  // Plata parada en mercadería (promedio ponderado × existencia). Es
  // patrimonio, no gasto.
  stockValue: number;
  // Mercadería que se perdió en el período: merma, rotura, faltantes.
  losses: { total: number; firstNames: string[] };
  costGaps: { soldWithoutCost: number; firstNames: string[]; productsWithoutCost: number };
  expensesByCategory: { key: string; label: string; total: number; percentage: number }[];
  comparison: { previousTotal: number; deltaPct: number | null } | null;
  accountBalances: { key: string; label: string; income: number; expense: number; balance: number }[];
  salesTrend: { label: string; total: number }[];
  salesByWeekday: { label: string; total: number }[];
  salesByBranch: { branchName: string; total: number; saleCount: number }[];
  topProducts: { name: string; total: number; quantity: number }[];
  totalsByStaff: { staffId: string; staffName: string; total: number; saleCount: number }[];
  totalsByPayment: { key: string; label: string; total: number; percentage: number }[];
  latestSales: {
    id: string;
    timeLabel: string;
    staffName: string;
    branchName: string;
    total: number;
    paymentLabel: string;
    itemSummary: string;
  }[];
  activeFilters: {
    staffId?: string;
    staffName?: string;
    paymentMethod?: string;
    paymentLabel?: string;
  };
  staffOptions: ReportsStaffOption[];
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
  staffId?: string;
  paymentMethod?: string;
};

function buildHref(query: FilterQuery) {
  const params = new URLSearchParams();
  params.set("range", query.range);
  if (query.range === DashboardRange.Custom) {
    if (query.from) params.set("from", query.from);
    if (query.to) params.set("to", query.to);
  }
  if (query.staffId) params.set("staffId", query.staffId);
  if (query.paymentMethod) params.set("paymentMethod", query.paymentMethod);

  // A /dashboard y no a "/": la landing redirige sin conservar la query, así
  // que los filtros se perdían en el camino.
  return `/dashboard?${params.toString()}`;
}

export function ReportsView({ data, userName = "admin" }: { data: ReportsData; userName?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [rangeKey, setRangeKey] = useState<DashboardRangeKey>(data.range.key);
  const [customFrom, setCustomFrom] = useState(data.range.fromValue);
  const [customTo, setCustomTo] = useState(data.range.toValue);
  const [staffId, setStaffId] = useState(data.activeFilters.staffId ?? "");
  const [paymentMethod, setPaymentMethod] = useState(data.activeFilters.paymentMethod ?? "");

  const maxStaffTotal = Math.max(...data.totalsByStaff.map((b) => b.total), 0);
  const maxBranchTotal = Math.max(...data.salesByBranch.map((b) => b.total), 0);
  const maxProductTotal = Math.max(...data.topProducts.map((s) => s.total), 0);
  const maxExpenseCategory = Math.max(...data.expensesByCategory.map((c) => c.total), 0);
  const heroLabel = data.range.isToday ? "Ventas de hoy" : data.range.label;
  const activeFilterCount = (data.activeFilters.staffId ? 1 : 0) + (data.activeFilters.paymentMethod ? 1 : 0);

  function navigate(href: string) {
    startTransition(() => router.push(href, { scroll: false }));
  }

  function openSheet() {
    setRangeKey(data.range.key);
    setCustomFrom(data.range.fromValue);
    setCustomTo(data.range.toValue);
    setStaffId(data.activeFilters.staffId ?? "");
    setPaymentMethod(data.activeFilters.paymentMethod ?? "");
    setSheetOpen(true);
  }

  function quickRange(key: DashboardRangeKey) {
    navigate(
      buildHref({
        range: key,
        staffId: data.activeFilters.staffId,
        paymentMethod: data.activeFilters.paymentMethod,
      }),
    );
  }

  function applyFilters() {
    setSheetOpen(false);
    navigate(buildHref({ range: rangeKey, from: customFrom, to: customTo, staffId, paymentMethod }));
  }

  function clearFilters() {
    setSheetOpen(false);
    navigate(`/?range=${DashboardRange.Today}`);
  }

  const customInvalid = rangeKey === DashboardRange.Custom && (!customFrom || !customTo || customFrom > customTo);

  return (
    <main className="mx-auto min-h-screen w-full min-w-0 max-w-[560px] overflow-x-clip bg-[var(--background)] px-4 pb-28 pt-6 text-slate-950 lg:max-w-none lg:px-8">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 duration-500 animate-in fade-in slide-in-from-top-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">Hola, {userName} 👋</p>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight text-slate-950">Resumen</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            aria-label="Registrar venta"
            className="flex size-11 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-950/5 transition active:scale-95"
            href="/sales/new"
          >
            <ReceiptText className="size-5" />
          </Link>
          <button
            aria-label="Cerrar sesión"
            className="flex size-11 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-950/5 transition active:scale-95"
            onClick={() => void logoutAction().then(() => window.location.assign("/login"))}
            type="button"
          >
            <LogOut className="size-5" />
          </button>
        </div>
      </header>

      {/* Sin catálogo no se puede vender: es lo primero que hay que resolver. */}
      {data.catalogEmpty ? (
        <Link
          className="mt-5 flex items-center gap-3 rounded-2xl bg-primary p-4 text-white shadow-sm transition active:scale-[0.99] duration-500 animate-in fade-in slide-in-from-bottom-2"
          href="/catalog"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/15">
            <Package className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-black">Cargá tus {data.catalogPlural.toLowerCase()}</span>
            <span className="block text-xs text-white/70">Sin catálogo no podés vender. Te lleva un minuto.</span>
          </span>
          <ArrowRight className="size-5 shrink-0" />
        </Link>
      ) : null}

      {/* Chips de período + filtros */}
      <div className="mt-5 flex items-center gap-2 duration-500 animate-in fade-in slide-in-from-bottom-2">
        <div className="-mx-1 flex flex-1 items-center gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {!QUICK_CHIPS.includes(data.range.key) ? (
            <button
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm shadow-primary/25 transition active:scale-95"
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
                  active ? "bg-primary text-white shadow-sm shadow-primary/25" : "bg-white text-slate-600 ring-1 ring-slate-950/5"
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
              ? "bg-primary text-white shadow-sm shadow-primary/25"
              : "bg-white text-slate-600 ring-1 ring-slate-950/5"
          }`}
          onClick={openSheet}
          type="button"
        >
          <SlidersHorizontal className="size-4" />
          {activeFilterCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[0.6rem] font-black text-white ring-2 ring-[var(--background)]">
              {activeFilterCount}
            </span>
          ) : null}
        </button>
      </div>

      {/* Chips de filtros activos (empleado / método) */}
      {data.activeFilters.staffId || data.activeFilters.paymentMethod ? (
        <div className="mt-3 flex flex-wrap gap-2 duration-500 animate-in fade-in">
          {data.activeFilters.staffName ? (
            <FilterPill
              icon={Users}
              label={data.activeFilters.staffName}
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
                navigate(buildHref({ range: data.range.key, from: customFrom, to: customTo, staffId: data.activeFilters.staffId }))
              }
            />
          ) : null}
        </div>
      ) : null}

      {/* Contenido (se atenúa mientras navega) */}
      <div className={isPending ? "pointer-events-none opacity-60 transition-opacity" : "transition-opacity"}>
        {/* Hero + KPIs (en fila en pantallas grandes) */}
        <div className="mt-4 grid gap-3 lg:grid-cols-12">
        {/* Hero total */}
        <div
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary-strong p-6 text-white shadow-lg shadow-primary/25 duration-700 animate-in fade-in slide-in-from-bottom-3 lg:col-span-7"
          style={{ animationDelay: "60ms", animationFillMode: "backwards" }}
        >
          <div className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-white/10 blur-xl" />
          {/* Blanco translúcido y no `text-primary/25`: la etiqueta va ENCIMA
              del degradado primario, así que teñirla del mismo color la borra. */}
          <p className="text-sm font-medium text-white/75">{heroLabel}</p>
          <AnimatedMoney className="mt-2 block text-[2.4rem] font-black leading-none tracking-tight" value={data.totalSold} />
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm font-medium">
            <span className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-white">
              <ReceiptText className="size-3.5" />
              {data.saleCount} ventas
            </span>
            {data.comparison && data.comparison.deltaPct !== null ? (
              <span
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-bold text-white ${
                  data.comparison.deltaPct >= 0 ? "bg-emerald-500/35" : "bg-rose-500/35"
                }`}
              >
                {data.comparison.deltaPct >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                {data.comparison.deltaPct >= 0 ? "+" : ""}
                {data.comparison.deltaPct}%
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-xs font-medium text-primary/40">
            {data.range.dateLabel}
            {data.comparison && data.comparison.deltaPct !== null ? " · vs período anterior" : ""}
          </p>
        </div>

        {/* KPIs (gastos, ganancia, mercadería, ticket) */}
        <div className="grid grid-cols-2 gap-3 lg:col-span-5 lg:content-start">
          <Link
            className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-950/5 transition active:scale-[0.98] duration-500 animate-in fade-in slide-in-from-bottom-2"
            href="/expenses"
            style={{ animationDelay: "100ms", animationFillMode: "backwards" }}
          >
            <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
              <Wallet className="size-3.5 text-rose-500" />
              Gastos
            </span>
            <AnimatedMoney className="mt-2 block text-xl font-black tracking-tight text-rose-600" delayMs={100} value={data.expensesTotal} />
          </Link>
          <div
            className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-950/5 duration-500 animate-in fade-in slide-in-from-bottom-2"
            style={{ animationDelay: "120ms", animationFillMode: "backwards" }}
          >
            <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
              {data.profit >= 0 ? <TrendingUp className="size-3.5 text-emerald-500" /> : <TrendingDown className="size-3.5 text-rose-500" />}
              Ganancia
            </span>
            <AnimatedMoney
              className={`mt-2 block text-xl font-black tracking-tight ${data.profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}
              delayMs={120}
              value={data.profit}
            />
          </div>
          {/* La mercadería comprada no se evaporó: está acá. Sin esta tarjeta,
              un mes de reposición fuerte se lee como un mes malo. */}
          <Link
            className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-950/5 transition active:scale-[0.98] duration-500 animate-in fade-in slide-in-from-bottom-2"
            href="/stock"
            style={{ animationDelay: "140ms", animationFillMode: "backwards" }}
          >
            <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
              <Package className="size-3.5 text-indigo-500" />
              En mercadería
            </span>
            <AnimatedMoney className="mt-2 block text-xl font-black tracking-tight text-slate-950" delayMs={140} value={data.stockValue} />
          </Link>
          <StatCard icon={Ticket} label="Ticket promedio" delay={200}>
            <AnimatedMoney className="mt-2 block text-xl font-black tracking-tight text-slate-950" delayMs={200} value={data.averageTicket} />
          </StatCard>
        </div>
        </div>

        {/* La mercadería que se perdió también es plata: se compró y no se va a
            vender nunca. Antes bajaba el stock en silencio. */}
        {data.losses.total > 0 ? (
          <Link
            className="mt-3 flex items-start gap-2.5 rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-950/5 transition active:scale-[0.99]"
            href="/stock"
          >
            <TrendingDown className="mt-0.5 size-4 shrink-0 text-rose-500" />
            <span className="text-xs font-semibold text-slate-600">
              Se perdió {formatMoney(data.losses.total)} en mercadería
              {data.losses.firstNames.length > 0 ? ` (${data.losses.firstNames.join(", ")})` : ""}: merma, rotura o
              faltantes de conteo. Ya está descontado de la ganancia.
            </span>
          </Link>
        ) : null}

        {/* Sin costos cargados la ganancia miente para arriba. Se dice, con los
            nombres, porque el arreglo es ir a la ficha y cargar el costo.
            Ojo con prometer de más: el costo se congela en el renglón al
            vender, así que cargarlo ahora arregla de acá en adelante, no lo ya
            vendido. */}
        {data.costGaps.soldWithoutCost > 0 ? (
          <Link
            className="mt-3 flex items-start gap-2.5 rounded-2xl bg-amber-50 px-4 py-3 text-amber-900 ring-1 ring-amber-200 transition active:scale-[0.99]"
            href="/catalog"
          >
            <TrendingUp className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <span className="text-xs font-semibold">
              La ganancia está inflada: se vendieron {data.costGaps.soldWithoutCost}{" "}
              {data.costGaps.soldWithoutCost === 1 ? "producto" : "productos"} sin costo cargado
              {data.costGaps.firstNames.length > 0 ? ` (${data.costGaps.firstNames.join(", ")}…)` : ""}. Cargales el costo
              en su ficha: se arregla para las ventas de acá en adelante.
            </span>
          </Link>
        ) : null}

        {/* Análisis (2 columnas tipo masonry en pantallas grandes) */}
        <div className="mt-3 lg:mt-4 lg:columns-2 lg:gap-4">
        {/* Cierre de caja: saldo por cuenta */}
        {data.accountBalances.length > 0 ? (
          <Panel delay={280} title="Saldo por cuenta" icon={Wallet}>
            <p className="-mt-2 mb-3 text-xs text-slate-500">Lo que entró por ventas menos los gastos, en cada cuenta.</p>
            <div className="space-y-2.5">
              {data.accountBalances.map((account) => (
                <div className="rounded-2xl bg-slate-50 p-3" key={account.key}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-black text-slate-800">{account.label}</span>
                    <span
                      className={`shrink-0 text-sm font-black ${account.balance >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {formatMoney(account.balance)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
                    <span className="flex items-center gap-1 text-emerald-600">
                      <TrendingUp className="size-3" />
                      {formatMoney(account.income)}
                    </span>
                    <span className="flex items-center gap-1 text-rose-500">
                      <TrendingDown className="size-3" />
                      {formatMoney(account.expense)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}

        {/* Tendencia */}
        {data.salesTrend.length >= 2 ? (
          <Panel delay={260} title="Ventas por día" icon={TrendingUp}>
            <SalesTrendChart data={data.salesTrend} />
          </Panel>
        ) : null}

        {/* Totales por empleado */}
        <Panel delay={320} title="Por empleado" icon={Users}>
          {data.totalsByStaff.length === 0 ? (
            <Empty>No hay ventas de empleados para estos filtros.</Empty>
          ) : (
            <div className="space-y-3.5">
              {data.totalsByStaff.map((staff, index) => (
                <div className="space-y-1.5" key={staff.staffId}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary">
                        {index + 1}
                      </span>
                      <span className="truncate font-bold text-slate-700">{staff.staffName}</span>
                      <span className="shrink-0 text-xs text-slate-400">({staff.saleCount})</span>
                    </span>
                    <span className="shrink-0 font-black text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatMoney(staff.total)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-indigo-500 transition-[width] duration-1000 ease-out"
                      style={{ width: `${maxStaffTotal > 0 ? Math.max((staff.total / maxStaffTotal) * 100, 6) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Métodos de pago (donut) */}
        <Panel delay={380} title="Métodos de pago" icon={CreditCard}>
          {data.totalsByPayment.length === 0 ? (
            <Empty>No hay pagos registrados para estos filtros.</Empty>
          ) : (
            <>
              <PaymentDonutChart data={data.totalsByPayment} />
              <div className="mt-4 grid gap-2.5">
                {data.totalsByPayment.map((payment, index) => (
                  <div className="flex items-center justify-between gap-3 text-sm" key={payment.key}>
                    <span className="flex min-w-0 items-center gap-2 font-bold text-slate-700">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: PAYMENT_DONUT_COLORS[index % PAYMENT_DONUT_COLORS.length] }}
                      />
                      <span className="truncate">{payment.label}</span>
                    </span>
                    <span className="shrink-0 font-black text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {payment.percentage}% · {formatMoney(payment.total)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>

        {/* Gastos por categoría. Sin mercadería: acá "gasto" significa siempre
            lo mismo, plata que no dejó nada atrás. */}
        <Panel delay={420} title="Gastos por categoría" icon={Wallet}>
          {data.expensesByCategory.length === 0 ? (
            <Empty>
              No hay gastos en este período.{" "}
              <Link className="font-black text-primary" href="/expenses">
                Registrar gasto
              </Link>
            </Empty>
          ) : (
            <>
              <p className="mb-3 text-xs text-slate-400">
                La mercadería no cuenta como gasto: la descuenta la venta, no la compra.
              </p>
              <div className="space-y-3.5">
                {data.expensesByCategory.map((category) => (
                  <div className="space-y-1.5" key={category.key}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-bold text-slate-700">{category.label}</span>
                      <span className="shrink-0 font-black text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {category.percentage}% · {formatMoney(category.total)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-600 transition-[width] duration-1000 ease-out"
                        style={{ width: `${maxExpenseCategory > 0 ? Math.max((category.total / maxExpenseCategory) * 100, 6) : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <Link
                className="mt-4 flex items-center justify-center gap-1 rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-black text-slate-700 transition active:scale-[0.99]"
                href="/expenses"
              >
                Ver todos los gastos
              </Link>
            </>
          )}
        </Panel>

        {/* Ventas por sucursal */}
        {data.salesByBranch.length > 0 ? (
          <Panel delay={440} title="Por sucursal" icon={Store}>
            <div className="space-y-3.5">
              {data.salesByBranch.map((branch) => (
                <div className="space-y-1.5" key={branch.branchName}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-bold text-slate-700">{branch.branchName}</span>
                    <span className="shrink-0 font-black text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatMoney(branch.total)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary transition-[width] duration-1000 ease-out"
                      style={{ width: `${maxBranchTotal > 0 ? Math.max((branch.total / maxBranchTotal) * 100, 6) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}

        {/* Top servicios */}
        {data.topProducts.length > 0 ? (
          <Panel delay={500} title="Lo más vendido" icon={Package}>
            <div className="space-y-3.5">
              {data.topProducts.map((product, index) => (
                <div className="space-y-1.5" key={product.name}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary">
                        {index + 1}
                      </span>
                      <span className="truncate font-bold text-slate-700">{product.name}</span>
                      <span className="shrink-0 text-xs text-slate-400">×{formatQuantity(product.quantity)}</span>
                    </span>
                    <span className="shrink-0 font-black text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatMoney(product.total)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-500 transition-[width] duration-1000 ease-out"
                      style={{ width: `${maxProductTotal > 0 ? Math.max((product.total / maxProductTotal) * 100, 6) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}

        {/* Ventas por día de la semana */}
        {data.salesByWeekday.some((day) => day.total > 0) ? (
          <Panel delay={560} title="Por día de la semana" icon={CalendarDays}>
            <SalesTrendChart data={data.salesByWeekday} />
          </Panel>
        ) : null}

        {/* Últimas ventas */}
        <div className="mb-4 break-inside-avoid duration-500 animate-in fade-in slide-in-from-bottom-3" style={{ animationDelay: "620ms", animationFillMode: "backwards" }}>
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-black text-slate-950">Últimas ventas</h2>
            <Link className="flex items-center gap-0.5 text-xs font-bold text-primary" href="/sales">
              Ver todas
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
          <div className="mt-3 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-950/5">
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
                      <p className="truncate text-sm font-bold text-slate-950">{sale.staffName}</p>
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
                <Calendar className="size-4 text-primary" />
                Período
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SHEET_PRESETS.map((key) => {
                  const active = rangeKey === key;
                  return (
                    <button
                      className={`rounded-full px-3.5 py-2 text-sm font-bold transition active:scale-95 ${
                        active ? "bg-primary text-white" : "bg-slate-100 text-slate-600"
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
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15"
                      max={customTo || undefined}
                      onChange={(event) => setCustomFrom(event.target.value)}
                      type="date"
                      value={customFrom}
                    />
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold text-slate-500">
                    Hasta
                    <input
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15"
                      min={customFrom || undefined}
                      onChange={(event) => setCustomTo(event.target.value)}
                      type="date"
                      value={customTo}
                    />
                  </label>
                </div>
              ) : null}
            </section>

            {/* Empleado */}
            <section>
              <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500" htmlFor="filter-staff">
                <Users className="size-4 text-primary" />
                Empleado
              </label>
              <select
                className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15"
                id="filter-staff"
                onChange={(event) => setStaffId(event.target.value)}
                value={staffId}
              >
                <option value="">Todos los empleados</option>
                {data.staffOptions.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name}
                  </option>
                ))}
              </select>
            </section>

            {/* Método de pago */}
            <section>
              <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500" htmlFor="filter-payment">
                <CreditCard className="size-4 text-primary" />
                Método de pago
              </label>
              <select
                className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15"
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
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-black text-white shadow-sm shadow-primary/25 transition hover:bg-primary-strong active:scale-[0.99] disabled:opacity-50"
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
        <Icon className="size-3.5 text-primary" />
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
      className="mb-4 break-inside-avoid rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-950/5 duration-500 animate-in fade-in slide-in-from-bottom-3"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "backwards" }}
    >
      <h2 className="flex items-center gap-2 text-base font-black text-slate-950">
        <Icon className="size-4 text-primary" />
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
    <span className="flex items-center gap-1.5 rounded-full bg-primary/10 py-1.5 pl-3 pr-1.5 text-sm font-bold text-primary ring-1 ring-primary/15">
      <Icon className="size-3.5" />
      <span className="max-w-[10rem] truncate">{label}</span>
      <button
        aria-label={`Quitar filtro ${label}`}
        className="flex size-5 items-center justify-center rounded-full bg-primary/15 text-primary transition active:scale-90"
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

