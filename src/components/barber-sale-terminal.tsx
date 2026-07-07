"use client";

import { submitBarberSale } from "@/app/barber/actions";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  ArrowLeftRight,
  ArrowRight,
  Banknote,
  Check,
  CreditCard,
  Minus,
  Plus,
  QrCode,
  Search,
  ShoppingBag,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { useMemo, useState, useTransition, type ComponentType } from "react";

export type SaleService = { serviceId: string; name: string; price: number };
export type SalePaymentOption = { value: string; label: string };

const paymentIcons: Record<string, ComponentType<{ className?: string }>> = {
  CASH: Banknote,
  DEBIT_CARD: CreditCard,
  CREDIT_CARD: CreditCard,
  TRANSFER: ArrowLeftRight,
  QR: QrCode,
  OTHER: Wallet,
};

function money(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

export function BarberSaleTerminal({
  services,
  paymentOptions,
}: {
  services: SaleService[];
  paymentOptions: SalePaymentOption[];
}) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [method, setMethod] = useState(paymentOptions[0]?.value ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? services.filter((service) => service.name.toLowerCase().includes(query)) : services;
  }, [services, search]);

  const cartItems = services.filter((service) => cart[service.serviceId]).map((service) => ({ ...service, quantity: cart[service.serviceId] }));
  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const hasItems = cartItems.length > 0;

  function add(serviceId: string) {
    setCart((current) => ({ ...current, [serviceId]: (current[serviceId] ?? 0) + 1 }));
  }
  function decrease(serviceId: string) {
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
  function remove(serviceId: string) {
    setCart((current) => {
      const next = { ...current };
      delete next[serviceId];
      return next;
    });
  }

  function confirm() {
    if (!hasItems || !method) return;
    setError(null);
    startTransition(async () => {
      const result = await submitBarberSale({
        items: cartItems.map((item) => ({ serviceId: item.serviceId, quantity: item.quantity })),
        paymentMethod: method,
      });
      if (result.ok) {
        setCart({});
        setCheckoutOpen(false);
        setSuccess(true);
        window.setTimeout(() => setSuccess(false), 1700);
      } else {
        setError(result.error);
      }
    });
  }

  if (services.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        Todavía no hay servicios cargados en esta sucursal. Pedile al administrador que los agregue.
      </div>
    );
  }

  return (
    <div>
      {services.length > 6 ? (
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-3 text-base font-semibold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar servicio…"
            value={search}
          />
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        {filtered.map((service) => {
          const quantity = cart[service.serviceId] ?? 0;
          const active = quantity > 0;
          return (
            <div
              className={`flex min-h-[7.5rem] flex-col justify-between rounded-2xl border-2 p-3.5 transition ${
                active ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white"
              }`}
              key={service.serviceId}
            >
              <button className="text-left active:scale-[0.99]" onClick={() => add(service.serviceId)} type="button">
                <span className="block text-base font-black leading-tight text-slate-950">{service.name}</span>
                <span className="mt-1.5 block text-lg font-black text-blue-700">{money(service.price)}</span>
              </button>
              {active ? (
                <div className="mt-3 flex items-center justify-between rounded-full bg-white p-1 ring-1 ring-blue-200">
                  <button
                    aria-label={`Restar ${service.name}`}
                    className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition active:scale-90"
                    onClick={() => decrease(service.serviceId)}
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
                    onClick={() => add(service.serviceId)}
                    type="button"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              ) : (
                <button
                  aria-label={`Agregar ${service.name}`}
                  className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-slate-100 text-sm font-black text-slate-700 transition active:scale-[0.97]"
                  onClick={() => add(service.serviceId)}
                  type="button"
                >
                  <Plus className="size-4" />
                  Agregar
                </button>
              )}
            </div>
          );
        })}
        {filtered.length === 0 ? (
          <p className="col-span-2 rounded-2xl border border-dashed border-slate-200 bg-white p-5 text-center text-sm text-slate-500">
            No hay servicios que coincidan.
          </p>
        ) : null}
      </div>

      {/* Barra de pedido (fija, sobre la nav) */}
      <div className="fixed inset-x-0 bottom-[5rem] z-30 mx-auto max-w-md px-4">
        <button
          className={`flex w-full items-center gap-3 rounded-[1.5rem] p-2.5 pl-5 text-left shadow-[0_-8px_40px_rgba(15,23,42,0.16)] transition active:scale-[0.99] ${
            hasItems ? "bg-blue-600" : "pointer-events-none bg-slate-300"
          }`}
          disabled={!hasItems}
          onClick={() => {
            setError(null);
            setCheckoutOpen(true);
          }}
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
            <span className="block text-xs font-bold text-white/80">{hasItems ? "Total" : "Tocá un servicio"}</span>
            <span className="block text-2xl font-black text-white" style={{ fontVariantNumeric: "tabular-nums" }}>
              {money(total)}
            </span>
          </span>
          <span className="flex items-center gap-1.5 rounded-2xl bg-white px-5 py-4 text-sm font-black text-blue-700">
            Cobrar
            <ArrowRight className="size-4" />
          </span>
        </button>
      </div>

      {/* Hoja: cobrar */}
      <BottomSheet onClose={() => setCheckoutOpen(false)} open={checkoutOpen} panelClassName="min-h-[60dvh]">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between px-5 pt-6">
            <h3 className="text-xl font-black tracking-tight text-slate-950">Cobrar</h3>
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
            <section>
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Pedido</p>
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
                        onClick={() => decrease(item.serviceId)}
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
                        onClick={() => add(item.serviceId)}
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
                      onClick={() => remove(item.serviceId)}
                      type="button"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">¿Cómo paga?</p>
              <div className="grid grid-cols-2 gap-2.5">
                {paymentOptions.map((option) => {
                  const Icon = paymentIcons[option.value] ?? Wallet;
                  const active = method === option.value;
                  return (
                    <button
                      className={`flex items-center gap-2.5 rounded-2xl px-4 py-4 text-sm font-black transition active:scale-95 ${
                        active ? "bg-blue-600 text-white shadow-sm shadow-blue-600/25" : "bg-slate-100 text-slate-700"
                      }`}
                      key={option.value}
                      onClick={() => setMethod(option.value)}
                      type="button"
                    >
                      <Icon className="size-5" />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </section>

            {error ? (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <div className="mt-auto border-t border-slate-100 px-5 pb-1 pt-4">
            <button
              className="flex w-full items-center justify-between gap-3 rounded-2xl bg-blue-600 px-6 py-4 text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              disabled={!hasItems || !method || isPending}
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
    </div>
  );
}
