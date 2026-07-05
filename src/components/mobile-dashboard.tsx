"use client";

import { AnimatedMoney, AnimatedNumber } from "@/components/animated-number";
import { Badge } from "@/components/ui/badge";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { DASHBOARD_RANGE_LABELS, DashboardRange, type DashboardRangeKey } from "@/lib/dashboard-range";
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpRight,
  BarChart3,
  Banknote,
  Bell,
  Calendar,
  Check,
  ChevronRight,
  CreditCard,
  HomeIcon,
  MoreHorizontal,
  QrCode,
  ReceiptText,
  Scissors,
  SlidersHorizontal,
  TriangleAlert,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ComponentType } from "react";

export type MobileTransaction = {
  id: string;
  barberName: string;
  branchName: string;
  itemSummary: string;
  total: number;
  timeLabel: string;
  paymentKey: string;
};

export type MobileBranchTotal = {
  branchId: string;
  branchName: string;
  total: number;
};

export type MobileBarberTotal = {
  barberId: string;
  barberName: string;
  saleCount: number;
};

export type MobileRange = {
  key: DashboardRangeKey;
  label: string;
  total: number;
  saleCount: number;
  dateLabel: string;
  fromValue: string;
  toValue: string;
  isToday: boolean;
};

export type MobileKpi = {
  total: number;
  saleCount: number;
};

export type MobileDashboardData = {
  userName: string;
  range: MobileRange;
  week: MobileKpi;
  month: MobileKpi;
  cancelledSalesToday: number;
  transactions: MobileTransaction[];
  salesByBranch: MobileBranchTotal[];
  topBarbers: MobileBarberTotal[];
};

const paymentStyles: Record<
  string,
  { label: string; icon: ComponentType<{ className?: string }>; chip: string }
> = {
  CASH: { label: "Efectivo", icon: Banknote, chip: "bg-emerald-50 text-emerald-600" },
  DEBIT_CARD: { label: "Débito", icon: CreditCard, chip: "bg-blue-50 text-blue-600" },
  CREDIT_CARD: { label: "Crédito", icon: CreditCard, chip: "bg-indigo-50 text-indigo-600" },
  TRANSFER: { label: "Transferencia", icon: ArrowLeftRight, chip: "bg-violet-50 text-violet-600" },
  QR: { label: "QR", icon: QrCode, chip: "bg-cyan-50 text-cyan-600" },
  OTHER: { label: "Otro", icon: Wallet, chip: "bg-slate-100 text-slate-600" },
  MIXED: { label: "Mixto", icon: Wallet, chip: "bg-amber-50 text-amber-600" },
  NONE: { label: "Sin pago", icon: Wallet, chip: "bg-slate-100 text-slate-500" },
};

// Accesos rápidos en la fila de chips.
const rangeChips: { key: DashboardRangeKey; label: string }[] = [
  { key: DashboardRange.Today, label: "Hoy" },
  { key: DashboardRange.Last7Days, label: "7d" },
  { key: DashboardRange.Last14Days, label: "14d" },
];

// Presets completos que muestra el panel de filtros (el rango personalizado va aparte).
const rangePresets: DashboardRangeKey[] = [
  DashboardRange.Today,
  DashboardRange.Last7Days,
  DashboardRange.Last14Days,
  DashboardRange.ThisMonth,
  DashboardRange.LastMonth,
  DashboardRange.ThisQuarter,
  DashboardRange.ThisSemester,
  DashboardRange.ThisYear,
];

const chipKeys = new Set<DashboardRangeKey>(rangeChips.map((chip) => chip.key));

const mobileNavigationItems = [
  { href: "/", label: "Inicio", icon: HomeIcon },
  { href: "/reports", label: "Reportes", icon: BarChart3 },
  { href: "/sales", label: "Ventas", icon: ReceiptText },
  { href: "/services", label: "Servicios", icon: Scissors },
  { href: "/barbers", label: "Más", icon: MoreHorizontal },
];

export function MobileDashboard({ data }: { data: MobileDashboardData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetView, setSheetView] = useState<"presets" | "custom">("presets");
  const [viewEntered, setViewEntered] = useState(true);
  const [customFrom, setCustomFrom] = useState(data.range.fromValue);
  const [customTo, setCustomTo] = useState(data.range.toValue);

  // Animación de transición entre vistas (presets ↔ personalizado), estilo push iOS.
  // `goToView` pone viewEntered=false de forma sincrónica con el cambio de vista, así
  // el nuevo panel se monta en el offset; luego este efecto lo lleva a su lugar (rAF
  // doble para que iOS pinte el estado inicial antes de transicionar).
  useEffect(() => {
    if (viewEntered) return;

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setViewEntered(true));
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [viewEntered]);

  const maxBranchTotal = Math.max(...data.salesByBranch.map((branch) => branch.total), 0);
  // Si el rango activo no está entre los chips rápidos, lo mostramos como pill destacado.
  const activePillLabel = chipKeys.has(data.range.key) ? null : data.range.label;

  function openSheet() {
    // Sincroniza las fechas del rango personalizado con el rango activo al abrir.
    setCustomFrom(data.range.fromValue);
    setCustomTo(data.range.toValue);
    setViewEntered(true); // la apertura no anima el slide de vista (solo sube el sheet)
    setSheetView(data.range.key === DashboardRange.Custom ? "custom" : "presets");
    setSheetOpen(true);
  }

  // Cambia de vista animando el slide: monta el nuevo panel en el offset (viewEntered=false).
  function goToView(view: "presets" | "custom") {
    setViewEntered(false);
    setSheetView(view);
  }

  function selectRange(key: DashboardRangeKey) {
    setSheetOpen(false);
    startTransition(() => {
      router.push(`/?range=${key}`, { scroll: false });
    });
  }

  const customRangeInvalid = !customFrom || !customTo || customFrom > customTo;

  function applyCustomRange() {
    if (customRangeInvalid) return;

    const params = new URLSearchParams({
      range: DashboardRange.Custom,
      from: customFrom,
      to: customTo,
    });

    startTransition(() => {
      router.push(`/?${params.toString()}`, { scroll: false });
      setSheetOpen(false);
    });
  }

  const heroLabel = data.range.isToday ? "Ingresos de hoy" : `Ingresos · ${data.range.label}`;

  // Push horizontal estilo iOS al cambiar de vista: personalizado entra desde la
  // derecha, presets (al volver) desde la izquierda. La transición es `none` al
  // posicionarse en el offset (instantáneo) y se activa al llevarlo a 0, así el
  // wrapper persistente solo anima la entrada (no el reseteo).
  const viewAnimStyle = {
    transform: viewEntered ? "translateX(0)" : `translateX(${sheetView === "custom" ? "64px" : "-64px"})`,
    transition: viewEntered ? "transform 0.42s cubic-bezier(0.33, 1, 0.68, 1)" : "none",
  };

  return (
    <section className="mx-auto min-h-screen max-w-[460px] bg-[#f6f7fb] px-4 pb-28 pt-6 md:hidden">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 duration-500 animate-in fade-in slide-in-from-top-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">Hola, {data.userName} 👋</p>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight text-slate-950">Ingresos</h1>
        </div>
        <button
          aria-label="Ver notificaciones"
          className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-950/5 transition active:scale-95"
          type="button"
        >
          <Bell className="size-5" />
          {data.cancelledSalesToday > 0 ? (
            <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-rose-500 ring-2 ring-white" />
          ) : null}
        </button>
      </header>

      {/* Filtro de período: chips rápidos + botón del panel completo */}
      <div className="mt-5 flex items-center gap-2 duration-500 animate-in fade-in slide-in-from-bottom-2">
        <div className="-mx-1 flex flex-1 items-center gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {activePillLabel ? (
            <button
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm shadow-blue-600/25 transition active:scale-95"
              onClick={openSheet}
              type="button"
            >
              {activePillLabel}
              <SlidersHorizontal className="size-3.5" />
            </button>
          ) : null}
          {rangeChips.map((chip) => {
            const active = data.range.key === chip.key;
            return (
              <button
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition active:scale-95 ${
                  active
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-600/25"
                    : "bg-white text-slate-600 ring-1 ring-slate-950/5 hover:text-slate-900"
                }`}
                key={chip.key}
                onClick={() => selectRange(chip.key)}
                type="button"
              >
                {chip.label}
              </button>
            );
          })}
        </div>
        <button
          aria-label="Más períodos"
          className={`flex size-10 shrink-0 items-center justify-center rounded-full transition active:scale-95 ${
            activePillLabel
              ? "bg-blue-600 text-white shadow-sm shadow-blue-600/25"
              : "bg-white text-slate-600 ring-1 ring-slate-950/5"
          }`}
          onClick={openSheet}
          type="button"
        >
          <SlidersHorizontal className="size-4" />
        </button>
      </div>

      {/* Filtro de períodos, en el bottom sheet reutilizable (animaciones + swipe-to-dismiss). */}
      <BottomSheet onClose={() => setSheetOpen(false)} open={sheetOpen} panelClassName="min-h-[68dvh]">
            <div className="flex min-h-0 flex-1 flex-col" style={viewAnimStyle}>
              {sheetView === "presets" ? (
              <>
                <div className="flex items-center justify-between px-5 pt-6">
                  <h3 className="text-xl font-black tracking-tight text-slate-950">Filtrar por período</h3>
                  <button
                    aria-label="Cerrar"
                    className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:scale-90"
                    onClick={() => setSheetOpen(false)}
                    type="button"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                <div className="grid min-h-0 flex-1 gap-1.5 overflow-y-auto px-5 pb-2 pt-4">
                  {rangePresets.map((preset) => {
                    const active = data.range.key === preset;
                    return (
                      <button
                        className={`flex items-center justify-between rounded-2xl px-4 py-3.5 text-base font-bold transition active:scale-[0.98] ${
                          active ? "bg-blue-50 text-blue-700 ring-1 ring-blue-100" : "text-slate-700 hover:bg-slate-50"
                        }`}
                        key={preset}
                        onClick={() => selectRange(preset)}
                        type="button"
                      >
                        {DASHBOARD_RANGE_LABELS[preset]}
                        {active ? <Check className="size-5" /> : null}
                      </button>
                    );
                  })}

                  <button
                    className={`mt-1 flex items-center justify-between rounded-2xl border border-dashed px-4 py-3.5 text-base font-bold transition active:scale-[0.98] ${
                      data.range.key === DashboardRange.Custom
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                    onClick={() => goToView("custom")}
                    type="button"
                  >
                    <span className="flex items-center gap-2.5">
                      <Calendar className="size-5 text-blue-600" />
                      Rango personalizado
                    </span>
                    <ChevronRight className="size-5 text-slate-400" />
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 px-5 pt-6">
                  <button
                    aria-label="Volver"
                    className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition active:scale-90"
                    onClick={() => goToView("presets")}
                    type="button"
                  >
                    <ArrowLeft className="size-5" />
                  </button>
                  <h3 className="flex-1 text-xl font-black tracking-tight text-slate-950">Rango personalizado</h3>
                  <button
                    aria-label="Cerrar"
                    className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:scale-90"
                    onClick={() => setSheetOpen(false)}
                    type="button"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-6">
                  <div className="grid gap-4">
                    <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                      Desde
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base font-bold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                        max={customTo || undefined}
                        onChange={(event) => setCustomFrom(event.target.value)}
                        type="date"
                        value={customFrom}
                      />
                    </label>
                    <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                      Hasta
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base font-bold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                        min={customFrom || undefined}
                        onChange={(event) => setCustomTo(event.target.value)}
                        type="date"
                        value={customTo}
                      />
                    </label>
                  </div>

                  {customFrom && customTo && customFrom > customTo ? (
                    <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
                      La fecha «Desde» no puede ser posterior a «Hasta».
                    </p>
                  ) : null}
                </div>

                {/* Footer fijo: el botón Aplicar siempre visible */}
                <div className="mt-auto border-t border-slate-100 px-5 pb-1 pt-4">
                  <button
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 text-base font-black text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.99] disabled:opacity-50"
                    disabled={customRangeInvalid || isPending}
                    onClick={applyCustomRange}
                    type="button"
                  >
                    <Check className="size-5" />
                    Aplicar
                  </button>
                </div>
              </>
            )}
            </div>
      </BottomSheet>

      {/* Contenido dependiente del rango */}
      <div className={isPending ? "pointer-events-none opacity-60 transition-opacity" : "transition-opacity"}>
        {/* Hero — ingresos del rango */}
        <div
          className="relative mt-4 overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-600 p-6 text-white shadow-lg shadow-blue-600/25 duration-700 animate-in fade-in slide-in-from-bottom-3"
          style={{ animationDelay: "60ms", animationFillMode: "backwards" }}
        >
          <div className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-white/10 blur-xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-8 size-40 rounded-full bg-white/10 blur-xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-100">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/70" />
                <span className="relative inline-flex size-2 rounded-full bg-white" />
              </span>
              {heroLabel}
            </div>
            <AnimatedMoney
              className="mt-3 block text-[2.6rem] font-black leading-none tracking-tight"
              value={data.range.total}
            />
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm font-medium text-blue-100">
              <span className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-white">
                <ReceiptText className="size-3.5" />
                {data.range.saleCount} ventas
              </span>
              <span className="truncate text-blue-100">{data.range.dateLabel}</span>
            </div>
          </div>
        </div>

        {/* Semana / Mes */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <StatCard label="Esta semana" total={data.week.total} saleCount={data.week.saleCount} delay={140} />
          <StatCard label="Este mes" total={data.month.total} saleCount={data.month.saleCount} delay={200} />
        </div>

        {/* Alerta de canceladas */}
        {data.cancelledSalesToday > 0 ? (
          <div
            className="mt-3 flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-rose-700 shadow-sm duration-500 animate-in fade-in slide-in-from-bottom-2"
            style={{ animationDelay: "240ms", animationFillMode: "backwards" }}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-rose-600 shadow-sm">
              <TriangleAlert className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-black">{data.cancelledSalesToday} ventas canceladas hoy</p>
              <p className="text-xs font-medium text-rose-500">Revisá el reporte para ver el detalle.</p>
            </div>
          </div>
        ) : null}

        {/* Transacciones recientes */}
        <div
          className="mt-5 duration-500 animate-in fade-in slide-in-from-bottom-3"
          style={{ animationDelay: "280ms", animationFillMode: "backwards" }}
        >
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-black text-slate-950">Transacciones recientes</h2>
            <Link className="flex items-center gap-0.5 text-xs font-bold text-blue-600" href="/sales">
              Ver todas
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>

          <div className="mt-3 overflow-hidden rounded-[1.5rem] bg-white shadow-sm ring-1 ring-slate-950/5">
            {data.transactions.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">No hay ventas completadas en este período.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.transactions.map((transaction, index) => {
                  const payment = paymentStyles[transaction.paymentKey] ?? paymentStyles.OTHER;
                  const PaymentIcon = payment.icon;
                  return (
                    <li
                      className="flex items-center gap-3 px-4 py-3 duration-500 animate-in fade-in slide-in-from-bottom-1"
                      key={transaction.id}
                      style={{ animationDelay: `${320 + index * 45}ms`, animationFillMode: "backwards" }}
                    >
                      <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${payment.chip}`}>
                        <PaymentIcon className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-950">{transaction.barberName}</p>
                        <p className="truncate text-xs text-slate-500">
                          {payment.label}
                          {transaction.itemSummary ? ` · ${transaction.itemSummary}` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-black text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {formatMoney(transaction.total)}
                        </p>
                        <p className="text-xs text-slate-400">{transaction.timeLabel} hs</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Ventas por sucursal */}
        {data.salesByBranch.length > 0 ? (
          <div
            className="mt-5 rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-slate-950/5 duration-500 animate-in fade-in slide-in-from-bottom-3"
            style={{ animationDelay: "360ms", animationFillMode: "backwards" }}
          >
            <h2 className="text-base font-black text-slate-950">Ventas por sucursal</h2>
            <div className="mt-4 space-y-3.5">
              {data.salesByBranch.map((branch) => (
                <div className="space-y-1.5" key={branch.branchId}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-bold text-slate-700">{branch.branchName}</span>
                    <span className="font-black text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatMoney(branch.total)}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-[width] duration-1000 ease-out"
                      style={{ width: `${maxBranchTotal > 0 ? Math.max((branch.total / maxBranchTotal) * 100, 8) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Top barberos */}
        {data.topBarbers.length > 0 ? (
          <div
            className="mt-5 rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-slate-950/5 duration-500 animate-in fade-in slide-in-from-bottom-3"
            style={{ animationDelay: "420ms", animationFillMode: "backwards" }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-slate-950">Top barberos</h2>
              <Badge className="border-blue-100 bg-blue-50 text-blue-700" variant="outline">
                Este mes
              </Badge>
            </div>
            <div className="mt-4 space-y-3">
              {data.topBarbers.map((barber, index) => (
                <div className="flex items-center gap-3" key={barber.barberId}>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-black text-blue-700">
                    {index + 1}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">{barber.barberName}</p>
                  <span className="text-xs font-semibold text-slate-500">
                    <AnimatedNumber value={barber.saleCount} /> ventas
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto grid max-w-[460px] grid-cols-5 border-t border-slate-200 bg-white/90 px-2 py-2 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-lg md:hidden">
        {mobileNavigationItems.map((item) => (
          <Link
            className={`flex flex-col items-center gap-1 rounded-2xl px-1.5 py-2 text-[0.68rem] font-bold transition active:scale-95 ${
              item.href === "/" ? "bg-blue-50 text-blue-700" : "text-slate-500"
            }`}
            href={item.href}
            key={item.href}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        ))}
      </nav>
    </section>
  );
}

function StatCard({
  label,
  total,
  saleCount,
  delay,
}: {
  label: string;
  total: number;
  saleCount: number;
  delay: number;
}) {
  return (
    <div
      className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-950/5 duration-500 animate-in fade-in slide-in-from-bottom-2"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "backwards" }}
    >
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <AnimatedMoney
        className="mt-2 block text-xl font-black tracking-tight text-slate-950"
        delayMs={delay}
        value={total}
      />
      <p className="mt-1 text-[0.7rem] font-medium text-slate-400">{saleCount} ventas</p>
    </div>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}
