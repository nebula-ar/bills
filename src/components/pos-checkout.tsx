"use client";

import { submitSale, type SubmitSaleInput } from "@/app/sales/new/actions";
import type { PaymentMethod } from "@/generated/prisma/client";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  ArrowLeftRight,
  ArrowRight,
  Banknote,
  Check,
  ChevronLeft,
  CreditCard,
  Minus,
  Plus,
  QrCode,
  Scissors,
  Search,
  ShoppingBag,
  Smartphone,
  Split,
  Store,
  Trash2,
  Wallet,
  X,
} from "@/components/icons";
import Link from "next/link";
import { useMemo, useState, useTransition, type ComponentType } from "react";

export type PosBranch = {
  id: string;
  name: string;
  businessName: string;
  barbers: { id: string; name: string }[];
  services: { serviceId: string; name: string; price: number }[];
};

export type PosPaymentOption = { value: string; label: string };

type PosCheckoutProps = {
  branches: PosBranch[];
  paymentOptions: PosPaymentOption[];
  initialBranchId?: string;
};

type SplitRow = { id: number; method: string; amount: string };

const paymentIcons: Record<string, ComponentType<{ className?: string }>> = {
  CASH: Banknote,
  DEBIT_CARD: CreditCard,
  CREDIT_CARD: CreditCard,
  TRANSFER: ArrowLeftRight,
  QR: QrCode,
  MERCADO_PAGO: Smartphone,
  OTHER: Wallet,
};

function money(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function PosCheckout({ branches, paymentOptions, initialBranchId }: PosCheckoutProps) {
  const [branchId, setBranchId] = useState(
    initialBranchId && branches.some((item) => item.id === initialBranchId) ? initialBranchId : branches[0]?.id ?? "",
  );
  const branch = branches.find((item) => item.id === branchId) ?? branches[0];
  const [barberId, setBarberId] = useState(branch?.barbers[0]?.id ?? "");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [splitMode, setSplitMode] = useState(false);
  const [singleMethod, setSingleMethod] = useState(paymentOptions[0]?.value ?? "");
  const [splitRows, setSplitRows] = useState<SplitRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const services = branch?.services ?? [];
  const filteredServices = useMemo(() => {
    const list = branch?.services ?? [];
    const query = search.trim().toLowerCase();
    return query ? list.filter((service) => service.name.toLowerCase().includes(query)) : list;
  }, [branch, search]);

  const cartItems = services
    .filter((service) => cart[service.serviceId])
    .map((service) => ({ ...service, quantity: cart[service.serviceId] }));
  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const hasItems = cartItems.length > 0;
  const selectedBarber = branch?.barbers.find((barber) => barber.id === barberId);

  const splitAssigned = splitRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const splitRemaining = total - splitAssigned;
  const splitValid = splitMode ? splitAssigned === total && splitRows.every((row) => Number(row.amount) > 0) : true;
  const canConfirm = Boolean(branch) && Boolean(barberId) && hasItems && splitValid && total > 0;

  const branchStep = branches.length > 1 ? 1 : 0;
  const barberStep = branchStep + 1;
  const serviceStep = barberStep + 1;

  function selectBranch(nextId: string) {
    const nextBranch = branches.find((item) => item.id === nextId);
    setBranchId(nextId);
    setBarberId(nextBranch?.barbers[0]?.id ?? "");
    setCart({});
    setError(null);
  }

  function addService(serviceId: string) {
    setCart((current) => ({ ...current, [serviceId]: (current[serviceId] ?? 0) + 1 }));
  }

  function decreaseService(serviceId: string) {
    setCart((current) => {
      const quantity = current[serviceId] ?? 0;
      if (quantity <= 1) {
        const next = { ...current };
        delete next[serviceId];
        return next;
      }
      return { ...current, [serviceId]: quantity - 1 };
    });
  }

  function removeService(serviceId: string) {
    setCart((current) => {
      const next = { ...current };
      delete next[serviceId];
      return next;
    });
  }

  function openCheckout() {
    if (!hasItems) return;
    setSplitMode(false);
    setSplitRows([]);
    setError(null);
    setCheckoutOpen(true);
  }

  function toggleSplit() {
    setSplitMode((open) => {
      const next = !open;
      if (next) setSplitRows([{ id: 1, method: singleMethod, amount: total > 0 ? String(total) : "" }]);
      return next;
    });
  }

  function addSplitRow() {
    const used = new Set(splitRows.map((row) => row.method));
    const nextMethod = paymentOptions.find((option) => !used.has(option.value))?.value ?? paymentOptions[0]?.value ?? "";
    const nextId = Math.max(0, ...splitRows.map((row) => row.id)) + 1;
    setSplitRows((rows) => [...rows, { id: nextId, method: nextMethod, amount: splitRemaining > 0 ? String(splitRemaining) : "" }]);
  }

  function updateSplitRow(id: number, patch: Partial<SplitRow>) {
    setSplitRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeSplitRow(id: number) {
    setSplitRows((rows) => rows.filter((row) => row.id !== id));
  }

  function confirm() {
    if (!branch || !canConfirm) return;
    setError(null);

    const payments: SubmitSaleInput["payments"] = splitMode
      ? splitRows.map((row) => ({ method: row.method as PaymentMethod, amount: Math.round(Number(row.amount) || 0) }))
      : [{ method: singleMethod as PaymentMethod, amount: total }];

    startTransition(async () => {
      const result = await submitSale({
        branchId: branch.id,
        barberId,
        items: cartItems.map((item) => ({ serviceId: item.serviceId, quantity: item.quantity })),
        payments,
      });
      if (result.ok) {
        setCart({});
        setSplitRows([]);
        setSplitMode(false);
        setCheckoutOpen(false);
        setSuccess(true);
        window.setTimeout(() => setSuccess(false), 1700);
      } else {
        setError(result.error);
      }
    });
  }

  if (!branch) {
    return (
      <main className="mx-auto min-h-screen max-w-[560px] px-4 py-10 text-slate-950">
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-600">
          No hay sucursales con barberos y servicios activos. Cargá una sucursal para vender.
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full min-w-0 max-w-[560px] overflow-x-clip bg-[#f6f7fb] px-4 pb-40 pt-6 text-slate-950 lg:max-w-[1000px] lg:px-6 lg:pb-10">
      <header className="flex items-center gap-3 duration-500 animate-in fade-in slide-in-from-top-2">
        <Link
          aria-label="Volver"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm ring-1 ring-slate-950/5 transition active:scale-95"
          href="/"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-500">{branch.businessName}</p>
          <h1 className="text-2xl font-black tracking-tight text-slate-950">Nueva venta</h1>
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[1fr_340px] lg:items-start lg:gap-6">
        <div className="lg:min-w-0">
      {branches.length > 1 ? (
        <Step icon={Store} step={branchStep} title="Sucursal" delay={80}>
          <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {branches.map((item) => (
              <button
                className={`shrink-0 rounded-2xl px-5 py-4 text-base font-black transition active:scale-95 ${
                  item.id === branchId ? "bg-blue-600 text-white shadow-sm shadow-blue-600/25" : "bg-white text-slate-700 ring-1 ring-slate-950/5"
                }`}
                key={item.id}
                onClick={() => selectBranch(item.id)}
                type="button"
              >
                {item.name}
              </button>
            ))}
          </div>
        </Step>
      ) : null}

      <Step icon={Scissors} step={barberStep} title="¿Quién atiende?" delay={140}>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {branch.barbers.map((barber) => {
            const active = barber.id === barberId;
            return (
              <button
                className={`flex items-center gap-3 rounded-2xl p-3 text-left transition active:scale-[0.98] ${
                  active ? "bg-blue-600 text-white shadow-sm shadow-blue-600/25" : "bg-white text-slate-700 ring-1 ring-slate-950/5"
                }`}
                key={barber.id}
                onClick={() => setBarberId(barber.id)}
                type="button"
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                    active ? "bg-white/20 text-white" : "bg-blue-50 text-blue-700"
                  }`}
                >
                  {initials(barber.name)}
                </span>
                <span className="min-w-0 text-sm font-black leading-tight">{barber.name}</span>
              </button>
            );
          })}
        </div>
      </Step>

      <Step icon={ShoppingBag} step={serviceStep} title="¿Qué se llevó?" delay={200}>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-3 text-base font-semibold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar servicio…"
            value={search}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filteredServices.map((service) => {
            const quantity = cart[service.serviceId] ?? 0;
            const active = quantity > 0;
            return (
              <div
                className={`flex min-h-[7.5rem] flex-col justify-between rounded-2xl border-2 p-3.5 transition ${
                  active ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white"
                }`}
                key={service.serviceId}
              >
                <button className="text-left active:scale-[0.99]" onClick={() => addService(service.serviceId)} type="button">
                  <span className="block text-base font-black leading-tight text-slate-950">{service.name}</span>
                  <span className="mt-1.5 block text-lg font-black text-blue-700">{money(service.price)}</span>
                </button>
                {active ? (
                  <div className="mt-3 flex items-center justify-between rounded-full bg-white p-1 ring-1 ring-blue-200">
                    <button
                      aria-label={`Restar ${service.name}`}
                      className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition active:scale-90"
                      onClick={() => decreaseService(service.serviceId)}
                      type="button"
                    >
                      <Minus className="size-4" />
                    </button>
                    <span className="text-lg font-black text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {quantity}
                    </span>
                    <button
                      aria-label={`Sumar ${service.name}`}
                      className="flex size-9 items-center justify-center rounded-full bg-blue-600 text-white transition active:scale-90"
                      onClick={() => addService(service.serviceId)}
                      type="button"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    aria-label={`Agregar ${service.name}`}
                    className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-slate-100 text-sm font-black text-slate-700 transition active:scale-[0.97]"
                    onClick={() => addService(service.serviceId)}
                    type="button"
                  >
                    <Plus className="size-4" />
                    Agregar
                  </button>
                )}
              </div>
            );
          })}
          {filteredServices.length === 0 ? (
            <p className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white p-5 text-center text-sm text-slate-500">
              No hay servicios que coincidan.
            </p>
          ) : null}
        </div>
      </Step>
        </div>

        <aside className="hidden lg:sticky lg:top-6 lg:block">
          <div className="rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-slate-950/5">
            <h2 className="flex items-center gap-2 text-base font-black text-slate-950">
              <ShoppingBag className="size-4 text-blue-600" />
              Pedido
            </h2>
            {hasItems ? (
              <>
                <div className="mt-4 space-y-2">
                  {cartItems.map((item) => (
                    <div className="flex items-center gap-2 text-sm" key={item.serviceId}>
                      <span className="min-w-0 flex-1 truncate font-bold text-slate-700">
                        {item.name} <span className="text-slate-400">×{item.quantity}</span>
                      </span>
                      <span className="shrink-0 font-black text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {money(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="text-sm font-bold text-slate-500">Total</span>
                  <span className="text-2xl font-black text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {money(total)}
                  </span>
                </div>
                <button
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 text-base font-black text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.99]"
                  onClick={openCheckout}
                  type="button"
                >
                  Cobrar
                  <ArrowRight className="size-4" />
                </button>
              </>
            ) : (
              <p className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
                Tocá un servicio para empezar.
              </p>
            )}
          </div>
        </aside>
      </div>

      {/* Barra de pedido (abrir checkout) — solo mobile/tablet chico */}
      <div className="fixed inset-x-0 bottom-[4.75rem] z-30 mx-auto max-w-[560px] px-4 sm:bottom-[7rem] lg:hidden">
        <button
          className={`flex w-full items-center gap-3 rounded-[1.5rem] p-2.5 pl-5 text-left shadow-[0_-8px_40px_rgba(15,23,42,0.16)] transition active:scale-[0.99] ${
            hasItems ? "bg-blue-600" : "pointer-events-none bg-slate-300"
          }`}
          disabled={!hasItems}
          onClick={openCheckout}
          type="button"
        >
          <span className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
            <ShoppingBag className="size-5" />
            {itemCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-white text-xs font-black text-blue-700">
                {itemCount}
              </span>
            ) : null}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold text-white/80">{hasItems ? "Total" : "Agregá servicios"}</span>
            <span className="block text-2xl font-black text-white" style={{ fontVariantNumeric: "tabular-nums" }}>
              {money(total)}
            </span>
          </span>
          <span className="flex items-center gap-1.5 rounded-2xl bg-white px-5 py-4 text-sm font-black text-blue-700">
            Continuar
            <ArrowRight className="size-4" />
          </span>
        </button>
      </div>

      {/* Hoja: revisar y pagar */}
      <BottomSheet onClose={() => setCheckoutOpen(false)} open={checkoutOpen} panelClassName="min-h-[70dvh]">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between px-5 pt-6">
            <div>
              <h3 className="text-xl font-black tracking-tight text-slate-950">Confirmar venta</h3>
              <p className="text-sm text-slate-500">{selectedBarber ? `Atiende ${selectedBarber.name}` : ""}</p>
            </div>
            <button
              aria-label="Cerrar"
              className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:scale-90"
              onClick={() => setCheckoutOpen(false)}
              type="button"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pt-5">
            {/* Pedido */}
            <section>
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Tu pedido</p>
              <div className="space-y-2">
                {cartItems.map((item) => (
                  <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-2.5" key={item.serviceId}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-950">{item.name}</p>
                      <p className="text-xs text-slate-500">{money(item.price)} c/u</p>
                    </div>
                    <div className="flex items-center rounded-full bg-white p-1 ring-1 ring-slate-950/5">
                      <button
                        aria-label={`Restar ${item.name}`}
                        className="flex size-8 items-center justify-center rounded-full text-slate-600 transition active:scale-90"
                        onClick={() => decreaseService(item.serviceId)}
                        type="button"
                      >
                        <Minus className="size-4" />
                      </button>
                      <span className="w-7 text-center text-sm font-black" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {item.quantity}
                      </span>
                      <button
                        aria-label={`Sumar ${item.name}`}
                        className="flex size-8 items-center justify-center rounded-full text-slate-600 transition active:scale-90"
                        onClick={() => addService(item.serviceId)}
                        type="button"
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>
                    <p className="w-20 shrink-0 text-right text-sm font-black text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {money(item.price * item.quantity)}
                    </p>
                    <button
                      aria-label={`Quitar ${item.name}`}
                      className="flex size-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition active:scale-90 hover:text-rose-600"
                      onClick={() => removeService(item.serviceId)}
                      type="button"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
                {!hasItems ? (
                  <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
                    El pedido está vacío.
                  </p>
                ) : null}
              </div>
            </section>

            {/* Pago */}
            <section>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">¿Cómo paga?</p>
                <button
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black transition active:scale-95 ${
                    splitMode ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                  onClick={toggleSplit}
                  type="button"
                >
                  <Split className="size-3.5" />
                  Dividir
                </button>
              </div>

              {splitMode ? (
                <div className="space-y-2.5">
                  {splitRows.map((row) => (
                    <div className="flex items-center gap-2" key={row.id}>
                      <select
                        className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-950 outline-none focus:border-blue-400 focus:bg-white"
                        onChange={(event) => updateSplitRow(row.id, { method: event.target.value })}
                        value={row.method}
                      >
                        {paymentOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-2 focus-within:border-blue-400 focus-within:bg-white">
                        <span className="text-sm font-bold text-slate-400">$</span>
                        <input
                          className="w-20 bg-transparent px-1 py-3 text-right text-sm font-black text-slate-950 outline-none"
                          inputMode="numeric"
                          onChange={(event) => updateSplitRow(row.id, { amount: event.target.value.replace(/\D/g, "") })}
                          placeholder="0"
                          value={row.amount}
                        />
                      </div>
                      {splitRows.length > 1 ? (
                        <button
                          aria-label="Quitar pago"
                          className="flex size-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition active:scale-90 hover:text-rose-600"
                          onClick={() => removeSplitRow(row.id)}
                          type="button"
                        >
                          <X className="size-4" />
                        </button>
                      ) : null}
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-1">
                    {splitRows.length < paymentOptions.length ? (
                      <button className="text-sm font-black text-blue-600" onClick={addSplitRow} type="button">
                        + Agregar método
                      </button>
                    ) : (
                      <span />
                    )}
                    <span className={`text-sm font-black ${splitRemaining === 0 ? "text-emerald-600" : "text-slate-500"}`}>
                      {splitRemaining === 0 ? "✓ Cubierto" : `Falta ${money(splitRemaining)}`}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {paymentOptions.map((option) => {
                    const Icon = paymentIcons[option.value] ?? Wallet;
                    const active = singleMethod === option.value;
                    return (
                      <button
                        className={`flex items-center gap-2.5 rounded-2xl px-4 py-4 text-sm font-black transition active:scale-95 ${
                          active ? "bg-blue-600 text-white shadow-sm shadow-blue-600/25" : "bg-slate-100 text-slate-700"
                        }`}
                        key={option.value}
                        onClick={() => setSingleMethod(option.value)}
                        type="button"
                      >
                        <Icon className="size-5" />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {error ? (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          {/* Footer: confirmar */}
          <div className="mt-auto border-t border-slate-100 px-5 pb-1 pt-4">
            <button
              className="flex w-full items-center justify-between gap-3 rounded-2xl bg-blue-600 px-6 py-4 text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              disabled={!canConfirm || isPending}
              onClick={confirm}
              type="button"
            >
              <span className="text-base font-black">{isPending ? "Registrando…" : "Confirmar venta"}</span>
              <span className="text-lg font-black" style={{ fontVariantNumeric: "tabular-nums" }}>
                {money(total)}
              </span>
            </button>
          </div>
        </div>
      </BottomSheet>

      {success ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm duration-200 animate-in fade-in">
          <div className="flex flex-col items-center gap-3 rounded-[2rem] bg-white px-12 py-10 shadow-2xl duration-300 animate-in zoom-in-95">
            <span className="flex size-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Check className="size-11" />
            </span>
            <p className="text-xl font-black text-slate-950">¡Venta registrada!</p>
            <p className="text-sm text-slate-500">Ya podés cargar la siguiente.</p>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Step({
  icon: Icon,
  step,
  title,
  delay,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  step: number;
  title: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <section
      className="mt-4 rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-slate-950/5 duration-500 animate-in fade-in slide-in-from-bottom-3"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "backwards" }}
    >
      <h2 className="mb-3 flex items-center gap-2.5 text-lg font-black text-slate-950">
        <span className="flex size-7 items-center justify-center rounded-full bg-blue-600 text-sm font-black text-white">{step}</span>
        <Icon className="size-5 text-blue-600" />
        {title}
      </h2>
      {children}
    </section>
  );
}
