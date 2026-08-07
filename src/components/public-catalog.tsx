"use client";

import { DynamicIcon, Minus, Plus } from "@/components/icons";
import type { Unit } from "@/generated/prisma/enums";
import { formatQuantity, lineTotal, ONE, unitShort } from "@/lib/quantity";
import { productImageSrc } from "@/modules/catalog/product-image-src.logic";
import { useMemo, useState } from "react";

// Catálogo público del negocio: lo que se comparte por Instagram o WhatsApp.
//
// No hay pagos ni envíos ni cuentas: el cliente arma el pedido y se lo manda al
// negocio por WhatsApp, que es como termina cerrándose la venta igual. Meter un
// checkout acá sería prometer algo que el comercio no puede sostener.

export type PublicCatalogProduct = {
  id: string;
  name: string;
  price: number;
  unit: Unit;
  categoryName: string | null;
  imageVersion: number | null;
  catalogSlug: string | null;
};

export type PublicCatalogProps = {
  token: string;
  businessName: string;
  catalogPlural: string;
  icon: string;
  note: string | null;
  products: PublicCatalogProduct[];
  whatsappPhone: string | null;
};

function money(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

export function PublicCatalog(props: PublicCatalogProps) {
  const [search, setSearch] = useState("");
  // El pedido guarda milésimas, igual que el mostrador.
  const [cart, setCart] = useState<Record<string, number>>({});

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return props.products;
    return props.products.filter(
      (product) =>
        product.name.toLowerCase().includes(query) || (product.categoryName ?? "").toLowerCase().includes(query),
    );
  }, [props.products, search]);

  const lines = props.products
    .filter((product) => (cart[product.id] ?? 0) > 0)
    .map((product) => ({ product, quantity: cart[product.id], total: lineTotal(cart[product.id], product.price) }));

  const total = lines.reduce((sum, line) => sum + line.total, 0);

  function add(id: string) {
    setCart((current) => ({ ...current, [id]: (current[id] ?? 0) + ONE }));
  }

  function remove(id: string) {
    setCart((current) => {
      const quantity = current[id] ?? 0;
      if (quantity <= ONE) {
        const next = { ...current };
        delete next[id];
        return next;
      }
      return { ...current, [id]: quantity - ONE };
    });
  }

  const message = [
    `Hola! Quiero hacer un pedido en *${props.businessName}*:`,
    "",
    ...lines.map((line) => `• ${formatQuantity(line.quantity, line.product.unit)} × ${line.product.name}`),
    "",
    `Total aproximado: ${money(total)}`,
  ].join("\n");

  const whatsapp = `https://wa.me/${(props.whatsappPhone ?? "").replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-32 pt-8">
      <header className="overflow-hidden rounded-3xl bg-slate-950 px-6 py-7 text-white shadow-xl">
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/10">
            <DynamicIcon className="size-6" name={props.icon} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-black tracking-tight">{props.businessName}</h1>
            <p className="text-sm text-white/60">{props.catalogPlural} y precios</p>
          </div>
        </div>
        {props.note ? <p className="mt-3 text-xs text-white/60">{props.note}</p> : null}
      </header>

      <input
        className="mt-5 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-primary/40"
        onChange={(event) => setSearch(event.target.value)}
        placeholder={`Buscar en ${props.catalogPlural.toLowerCase()}…`}
        value={search}
      />

      {filtered.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No encontramos nada con eso.
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3">
          {filtered.map((product) => {
            const quantity = cart[product.id] ?? 0;
            // Acá no hay sesión: la foto propia se pide por la ruta del token.
            const imageSrc = productImageSrc(product, { publicToken: props.token });

            return (
              <li className="flex flex-col rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-950/5" key={product.id}>
                {imageSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt=""
                    className="mb-2 aspect-square w-full rounded-xl bg-slate-100 object-cover"
                    loading="lazy"
                    src={imageSrc}
                  />
                ) : (
                  <span className="mb-2 flex aspect-square w-full items-center justify-center rounded-xl bg-slate-100">
                    <DynamicIcon className="size-8 text-slate-300" name={props.icon} />
                  </span>
                )}

                <p className="text-sm font-black leading-tight text-slate-950">{product.name}</p>
                <p className="mt-1 text-lg font-black text-primary">
                  {money(product.price)}
                  <span className="text-xs font-bold text-primary">/{unitShort(product.unit)}</span>
                </p>

                <div className="mt-auto pt-2">
                  {quantity > 0 ? (
                    <div className="flex items-center justify-between rounded-full bg-primary/10 p-1 ring-1 ring-primary/20">
                      <button
                        aria-label={`Quitar ${product.name}`}
                        className="grid size-8 place-items-center rounded-full bg-white text-slate-700"
                        onClick={() => remove(product.id)}
                        type="button"
                      >
                        <Minus className="size-4" />
                      </button>
                      <span className="text-sm font-black text-slate-950">{formatQuantity(quantity)}</span>
                      <button
                        aria-label={`Sumar ${product.name}`}
                        className="grid size-8 place-items-center rounded-full bg-primary text-white"
                        onClick={() => add(product.id)}
                        type="button"
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      aria-label={`Agregar ${product.name}`}
                      className="flex w-full items-center justify-center gap-1.5 rounded-full bg-slate-100 py-2 text-sm font-black text-slate-700 transition active:scale-95"
                      onClick={() => add(product.id)}
                      type="button"
                    >
                      <Plus className="size-4" />
                      Agregar
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 text-center text-xs text-slate-400">Catálogo publicado con Bills</p>

      {/* Barra del pedido: aparece recién cuando hay algo, para no tapar nada. */}
      {lines.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <a
            className="flex items-center justify-between gap-3 rounded-2xl bg-emerald-600 px-5 py-4 text-white shadow-lg shadow-emerald-600/30"
            href={whatsapp}
            rel="noreferrer"
            target="_blank"
          >
            <span className="min-w-0">
              <span className="block text-xs font-bold text-white/70">
                {lines.length} {lines.length === 1 ? "ítem" : "ítems"}
              </span>
              <span className="block text-xl font-black tracking-tight">{money(total)}</span>
            </span>
            <span className="shrink-0 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-black">Pedir por WhatsApp</span>
          </a>
        </div>
      ) : null}
    </main>
  );
}
