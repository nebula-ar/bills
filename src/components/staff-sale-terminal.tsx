"use client";

import { submitStaffSale } from "@/app/terminal/actions";
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
  ShoppingBag,
  Search,
  Smartphone,
  Trash2,
  Wallet,
  X,
} from "@/components/icons";
import { useMemo, useState, useTransition, type ComponentType } from "react";
import { formatQuantity, lineTotal, ONE } from "@/lib/quantity";

export type SaleProduct = { productId: string; name: string; price: number };
export type SalePaymentOption = { value: string; label: string };

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

function IdentityLine({ staffName, branchName, terminalName }: { staffName: string; branchName: string; terminalName: string | null }) {
  return (
    <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
      <ShoppingBag aria-hidden="true" className="shrink-0 text-blue-600" size={15} />
      <span className="truncate">
        {staffName} · {branchName}
        {terminalName ? ` · ${terminalName}` : ""}
      </span>
    </div>
  );
}

export function StaffSaleTerminal({
  products,
  paymentOptions,
  staffName,
  branchName,
  terminalName,
}: {
  products: SaleProduct[];
  paymentOptions: SalePaymentOption[];
  staffName: string;
  branchName: string;
  terminalName: string | null;
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
    return query ? products.filter((product) => product.name.toLowerCase().includes(query)) : products;
  }, [products, search]);

  // El carrito guarda MILÉSIMAS de unidad, igual que la base y que el POS: la
  // venta se graba con esa escala, así que contar de a 1 haría que un corte de
  // $9.000 se registre como $9.
  const cartItems = products.filter((product) => cart[product.productId]).map((product) => ({ ...product, quantity: cart[product.productId] }));
  const total = cartItems.reduce((sum, item) => sum + lineTotal(item.price, item.quantity), 0);
  const itemCount = cartItems.length;
  const hasItems = cartItems.length > 0;

  function add(productId: string) {
    setCart((current) => ({ ...current, [productId]: (current[productId] ?? 0) + ONE }));
  }
  function decrease(productId: string) {
    setCart((current) => {
      const quantity = current[productId] ?? 0;
      if (quantity <= ONE) {
        const next = { ...current };
        delete next[productId];
        return next;
      }
      return { ...current, [productId]: quantity - ONE };
    });
  }
  function remove(productId: string) {
    setCart((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
  }

  function confirm() {
    if (!hasItems || !method) return;
    setError(null);
    startTransition(async () => {
      const result = await submitStaffSale({
        items: cartItems.map((item) => ({ productId: item.productId, quantity: item.quantity })),
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

  if (products.length === 0) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <IdentityLine staffName={staffName} branchName={branchName} terminalName={terminalName} />
        <div className="mt-4 rounded-3xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          Todavía no hay servicios cargados en esta sucursal. Pedile al administrador que los agregue.
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Servicios (scrollean) */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-4">
        <IdentityLine staffName={staffName} branchName={branchName} terminalName={terminalName} />

        {products.length > 6 ? (
          <div className="relative mb-3 mt-3">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-3 text-base font-semibold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar servicio…"
              value={search}
            />
          </div>
        ) : null}

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((product) => {
            const quantity = cart[product.productId] ?? 0;
            const active = quantity > 0;
            return (
              <div
                className={`flex min-h-[7.5rem] flex-col justify-between rounded-2xl border-2 p-3.5 transition ${
                  active ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white"
                }`}
                key={product.productId}
              >
                <button className="text-left active:scale-[0.99]" onClick={() => add(product.productId)} type="button">
                  <span className="block text-base font-black leading-tight text-slate-950">{product.name}</span>
                  <span className="mt-1.5 block text-lg font-black text-blue-700">{money(product.price)}</span>
                </button>
                {active ? (
                  <div className="mt-3 flex items-center justify-between rounded-full bg-white p-1 ring-1 ring-blue-200">
                    <button
                      aria-label={`Restar ${product.name}`}
                      className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition active:scale-90"
                      onClick={() => decrease(product.productId)}
                      type="button"
                    >
                      <Minus className="size-4" />
                    </button>
                    <span className="text-lg font-black text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatQuantity(quantity)}
                    </span>
                    <button
                      aria-label={`Sumar ${product.name}`}
                      className="flex size-9 items-center justify-center rounded-full bg-blue-600 text-white transition active:scale-90"
                      onClick={() => add(product.productId)}
                      type="button"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    aria-label={`Agregar ${product.name}`}
                    className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-slate-100 text-sm font-black text-slate-700 transition active:scale-[0.97]"
                    onClick={() => add(product.productId)}
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
            <p className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white p-5 text-center text-sm text-slate-500">
              No hay servicios que coincidan.
            </p>
          ) : null}
        </div>
      </div>

      {/* Barra de cobro (footer de la tarjeta) */}
      <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-3">
        <button
          className={`flex w-full items-center gap-3 rounded-[1.5rem] p-2 pl-5 text-left transition active:scale-[0.99] ${
            hasItems ? "bg-blue-600" : "pointer-events-none bg-slate-200"
          }`}
          disabled={!hasItems}
          onClick={() => {
            setError(null);
            setCheckoutOpen(true);
          }}
          type="button"
        >
          <span className={`relative flex size-11 shrink-0 items-center justify-center rounded-full ${hasItems ? "bg-white/15 text-white" : "bg-white text-slate-400"}`}>
            <ShoppingBag className="size-5" />
            {itemCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-white text-xs font-black text-blue-700">
                {itemCount}
              </span>
            ) : null}
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block text-xs font-bold ${hasItems ? "text-white/80" : "text-slate-500"}`}>
              {hasItems ? "Total" : "Tocá un servicio para empezar"}
            </span>
            <span className={`block text-2xl font-black ${hasItems ? "text-white" : "text-slate-400"}`} style={{ fontVariantNumeric: "tabular-nums" }}>
              {money(total)}
            </span>
          </span>
          <span className={`flex items-center gap-1.5 rounded-2xl px-5 py-4 text-sm font-black ${hasItems ? "bg-white text-blue-700" : "bg-white/70 text-slate-400"}`}>
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
                  <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-2.5" key={item.productId}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-950">{item.name}</p>
                      <p className="text-xs text-slate-500">{money(item.price)} c/u</p>
                    </div>
                    <div className="flex items-center rounded-full bg-white p-1 ring-1 ring-slate-950/5">
                      <button
                        aria-label={`Restar ${item.name}`}
                        className="flex size-8 items-center justify-center rounded-full text-slate-600 transition active:scale-90"
                        onClick={() => decrease(item.productId)}
                        type="button"
                      >
                        <Minus className="size-4" />
                      </button>
                      <span className="w-7 text-center text-sm font-black" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {formatQuantity(item.quantity)}
                      </span>
                      <button
                        aria-label={`Sumar ${item.name}`}
                        className="flex size-8 items-center justify-center rounded-full text-slate-600 transition active:scale-90"
                        onClick={() => add(item.productId)}
                        type="button"
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>
                    <p className="w-20 shrink-0 text-right text-sm font-black text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {money(lineTotal(item.price, item.quantity))}
                    </p>
                    <button
                      aria-label={`Quitar ${item.name}`}
                      className="flex size-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition active:scale-90 hover:text-rose-600"
                      onClick={() => remove(item.productId)}
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
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm duration-200 animate-in fade-in">
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
