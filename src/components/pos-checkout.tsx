"use client";

import { submitSale, type SubmitSaleInput } from "@/app/sales/new/actions";
import type { PaymentMethod } from "@/generated/prisma/client";
import { Check, ChevronLeft, Minus, Plus, Scissors, Search, Split, Store, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

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
};

type SplitRow = { id: number; method: string; amount: string };

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

export function PosCheckout({ branches, paymentOptions }: PosCheckoutProps) {
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const branch = branches.find((item) => item.id === branchId) ?? branches[0];
  const [barberId, setBarberId] = useState(branch?.barbers[0]?.id ?? "");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
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
  const hasItems = cartItems.length > 0;

  const splitAssigned = splitRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const splitRemaining = total - splitAssigned;
  const splitValid = splitMode ? splitAssigned === total && splitRows.every((row) => Number(row.amount) > 0) : true;
  const canConfirm = Boolean(branch) && Boolean(barberId) && hasItems && splitValid && total > 0;

  function selectBranch(nextId: string) {
    const nextBranch = branches.find((item) => item.id === nextId);
    setBranchId(nextId);
    setBarberId(nextBranch?.barbers[0]?.id ?? "");
    setCart({});
    setSplitRows([]);
    setSplitMode(false);
    setError(null);
  }

  function addService(serviceId: string) {
    setCart((current) => ({ ...current, [serviceId]: (current[serviceId] ?? 0) + 1 }));
    setError(null);
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

  function toggleSplit() {
    setSplitMode((open) => {
      const next = !open;
      if (next) {
        setSplitRows([{ id: 1, method: singleMethod, amount: total > 0 ? String(total) : "" }]);
      }
      return next;
    });
  }

  function addSplitRow() {
    const usedMethods = new Set(splitRows.map((row) => row.method));
    const nextMethod = paymentOptions.find((option) => !usedMethods.has(option.value))?.value ?? paymentOptions[0]?.value ?? "";
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

    const input: SubmitSaleInput = {
      branchId: branch.id,
      barberId,
      items: cartItems.map((item) => ({ serviceId: item.serviceId, quantity: item.quantity })),
      payments,
    };

    startTransition(async () => {
      const result = await submitSale(input);
      if (result.ok) {
        setCart({});
        setSplitRows([]);
        setSplitMode(false);
        setSuccess(true);
        window.setTimeout(() => setSuccess(false), 1600);
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
    <main className="mx-auto min-h-screen w-full min-w-0 max-w-[560px] overflow-x-clip bg-[#f6f7fb] px-4 pb-44 pt-6 text-slate-950">
      <header className="flex items-center justify-between gap-4 duration-500 animate-in fade-in slide-in-from-top-2">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            aria-label="Volver"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm ring-1 ring-slate-950/5 transition active:scale-95"
            href="/"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-500">{branch.businessName}</p>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">Nueva venta</h1>
          </div>
        </div>
      </header>

      {/* Sucursal */}
      {branches.length > 1 ? (
        <Section icon={Store} title="Sucursal" delay={80}>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {branches.map((item) => (
              <button
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition active:scale-95 ${
                  item.id === branchId ? "bg-blue-600 text-white shadow-sm shadow-blue-600/25" : "bg-white text-slate-600 ring-1 ring-slate-950/5"
                }`}
                key={item.id}
                onClick={() => selectBranch(item.id)}
                type="button"
              >
                {item.name}
              </button>
            ))}
          </div>
        </Section>
      ) : null}

      {/* Barbero */}
      <Section icon={Scissors} title="Barbero" delay={140}>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {branch.barbers.map((barber) => {
            const active = barber.id === barberId;
            return (
              <button
                className={`flex shrink-0 items-center gap-2 rounded-full py-1.5 pl-1.5 pr-4 text-sm font-bold transition active:scale-95 ${
                  active ? "bg-blue-600 text-white shadow-sm shadow-blue-600/25" : "bg-white text-slate-600 ring-1 ring-slate-950/5"
                }`}
                key={barber.id}
                onClick={() => setBarberId(barber.id)}
                type="button"
              >
                <span
                  className={`flex size-7 items-center justify-center rounded-full text-xs font-black ${
                    active ? "bg-white/20 text-white" : "bg-blue-50 text-blue-700"
                  }`}
                >
                  {initials(barber.name)}
                </span>
                {barber.name}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Servicios */}
      <Section icon={Scissors} title="Servicios" delay={200}>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-9 pr-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar servicio…"
            value={search}
          />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {filteredServices.map((service) => {
            const quantity = cart[service.serviceId] ?? 0;
            const active = quantity > 0;
            return (
              <button
                className={`relative min-h-[5.5rem] rounded-2xl border p-3 text-left transition active:scale-[0.98] ${
                  active ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-200"
                }`}
                key={service.serviceId}
                onClick={() => addService(service.serviceId)}
                type="button"
              >
                {active ? (
                  <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">
                    {quantity}
                  </span>
                ) : (
                  <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <Plus className="size-3.5" />
                  </span>
                )}
                <span className="block pr-7 text-sm font-black leading-5 text-slate-950">{service.name}</span>
                <span className="mt-2 block text-base font-black text-blue-700">{money(service.price)}</span>
              </button>
            );
          })}
          {filteredServices.length === 0 ? (
            <p className="col-span-2 rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-500">
              No hay servicios que coincidan.
            </p>
          ) : null}
        </div>
      </Section>

      {/* Carrito */}
      {hasItems ? (
        <Section icon={Check} title="Carrito" delay={0}>
          <div className="space-y-2.5">
            {cartItems.map((item) => (
              <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-2.5" key={item.serviceId}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-950">{item.name}</p>
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
                  <span className="w-7 text-center text-sm font-black text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
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
          </div>
        </Section>
      ) : null}

      {/* Pago */}
      <Section icon={Split} title="Pago" delay={0}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold text-slate-500">{splitMode ? "Pago dividido" : "Método de pago"}</p>
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
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-950 outline-none focus:border-blue-400 focus:bg-white"
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
                    className="w-20 bg-transparent px-1 py-2.5 text-right text-sm font-black text-slate-950 outline-none"
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
                {splitRemaining === 0 ? "✓ Cubierto" : `Restante ${money(splitRemaining)}`}
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {paymentOptions.map((option) => (
              <button
                className={`rounded-xl px-3 py-3 text-sm font-black transition active:scale-95 ${
                  singleMethod === option.value ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                }`}
                key={option.value}
                onClick={() => setSingleMethod(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </Section>

      {error ? (
        <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 duration-300 animate-in fade-in" role="alert">
          {error}
        </p>
      ) : null}

      {/* Barra de total + confirmar (sobre la nav global) */}
      <div className="fixed inset-x-0 bottom-[4.75rem] z-30 mx-auto max-w-[560px] px-4">
        <div className="flex items-center gap-3 rounded-[1.5rem] bg-white p-3 shadow-[0_-8px_40px_rgba(15,23,42,0.14)] ring-1 ring-slate-950/5">
          <div className="min-w-0 flex-1 pl-2">
            <p className="text-xs font-bold text-slate-500">Total</p>
            <p className="text-2xl font-black tracking-tight text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
              {money(total)}
            </p>
          </div>
          <button
            className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-4 text-sm font-black text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            disabled={!canConfirm || isPending}
            onClick={confirm}
            type="button"
          >
            {isPending ? "Registrando…" : "Confirmar venta"}
          </button>
        </div>
      </div>

      {/* Éxito */}
      {success ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/30 backdrop-blur-sm duration-200 animate-in fade-in">
          <div className="flex flex-col items-center gap-3 rounded-[2rem] bg-white px-10 py-8 shadow-2xl duration-300 animate-in zoom-in-95">
            <span className="flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Check className="size-9" />
            </span>
            <p className="text-lg font-black text-slate-950">¡Venta registrada!</p>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Section({
  icon: Icon,
  title,
  delay,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <section
      className="mt-4 rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-slate-950/5 duration-500 animate-in fade-in slide-in-from-bottom-3"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "backwards" }}
    >
      <h2 className="mb-3 flex items-center gap-2 text-base font-black text-slate-950">
        <Icon className="size-4 text-blue-600" />
        {title}
      </h2>
      {children}
    </section>
  );
}
