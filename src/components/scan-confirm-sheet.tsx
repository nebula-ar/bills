"use client";

import { Check, DynamicIcon, Minus, Plus, TriangleAlert, X } from "@/components/icons";
import type { Unit } from "@/generated/prisma/enums";
import { allowsFraction, formatQuantity, lineTotal, ONE, parseQuantityInput, unitShort } from "@/lib/quantity";
import { productImageSrc } from "@/modules/catalog/product-image-src.logic";
import { useState } from "react";
import { createPortal } from "react-dom";

// Confirmación de lo escaneado, antes de que entre al pedido.
//
// Antes el escaneo sumaba una unidad y seguía leyendo. Va rápido, pero el que
// atiende no ve QUÉ agregó hasta que mira el carrito, y un código mal leído o
// un producto parecido se cuela sin que nadie lo note. Acá se ve la foto, el
// nombre, el precio y cuánto queda, y se confirma con un toque.
//
// La cantidad importa tanto como el producto: escanear una vez y llevar seis
// es lo normal en un kiosco, y hacer seis lecturas del mismo código es una
// pérdida de tiempo que nadie se banca con el cliente enfrente.

export type ScannedProduct = {
  productId: string;
  name: string;
  price: number;
  unit: Unit;
  stock: number | null;
  imageVersion: number | null;
  catalogSlug: string | null;
  packSize: number | null;
  packLabel: string | null;
};

function money(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

export function ScanConfirmSheet({
  product,
  // Lo que ya había de este producto en el pedido, para avisar del total real.
  alreadyInCart,
  catalogIcon,
  onConfirm,
  onCancel,
}: {
  product: ScannedProduct | null;
  alreadyInCart: number;
  catalogIcon: string;
  // Cantidad en milésimas.
  onConfirm: (quantity: number) => void;
  onCancel: () => void;
}) {
  const byWeight = product ? allowsFraction(product.unit) : false;
  // Arranca en 1, salvo lo que se vende por peso: nadie sabe cuánto pesa hasta
  // ponerlo en la balanza. El componente se remonta con cada producto (ver la
  // prop `key` en el mostrador), así que esto se recalcula solo.
  const [quantity, setQuantity] = useState(byWeight ? 0 : ONE);
  const [raw, setRaw] = useState("");

  if (!product) return null;

  const total = lineTotal(quantity, product.price);
  const totalConCarrito = alreadyInCart + quantity;
  const sinStock = product.stock !== null && totalConCarrito > product.stock;
  const puedeAgregar = quantity > 0;
  const imageSrc = productImageSrc({ id: product.productId, imageVersion: product.imageVersion, catalogSlug: product.catalogSlug });

  function step(delta: number) {
    setQuantity((current) => Math.max(ONE, current + delta * ONE));
  }

  // Va en un portal y por ENCIMA del lector (que es z-80): el lector ocupa toda
  // la pantalla, así que una confirmación por debajo sería invisible.
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center">
      <button aria-label="Cancelar" className="absolute inset-0 bg-slate-950/70" onClick={onCancel} type="button" />

      <div className="relative flex w-full max-w-[460px] flex-col rounded-t-[2rem] bg-white pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-12px_50px_rgba(15,23,42,0.35)] duration-200 animate-in slide-in-from-bottom-4">
        <div className="flex items-start gap-3 px-5 pt-5">
          {imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt=""
              className="size-20 shrink-0 rounded-2xl bg-slate-100 object-cover"
              src={imageSrc}
            />
          ) : (
            <span className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <DynamicIcon className="size-9" name={catalogIcon} />
            </span>
          )}

          <div className="min-w-0 flex-1">
            <p className="text-xl font-black leading-tight text-slate-950">{product.name}</p>
            <p className="mt-1 text-lg font-black text-primary">
              {money(product.price)}
              {byWeight ? <span className="text-sm font-bold text-primary"> por {unitShort(product.unit)}</span> : null}
            </p>
            {product.stock !== null ? (
              <p className={`mt-0.5 text-xs font-bold ${sinStock ? "text-rose-600" : "text-slate-400"}`}>
                Quedan {formatQuantity(product.stock, product.unit)}
              </p>
            ) : null}
          </div>

          <button
            aria-label="Cancelar"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:scale-90"
            data-testid="scan-cancel"
            onClick={onCancel}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="px-5 pt-4">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">¿Cuántos?</p>

          {byWeight ? (
            // Por peso o por metro no hay +/- que valga: se escribe lo que dio
            // la balanza.
            <label className="mt-2 flex items-center rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 focus-within:border-primary/40 focus-within:bg-white">
              <input
                aria-label={`Cantidad en ${unitShort(product.unit)}`}
                className="w-full min-w-0 bg-transparent py-4 text-2xl font-black text-slate-950 outline-none"
                inputMode="decimal"
                onChange={(event) => {
                  setRaw(event.target.value);
                  setQuantity(parseQuantityInput(event.target.value, product.unit) ?? 0);
                }}
                placeholder="0"
                value={raw}
              />
              <span className="shrink-0 text-base font-black text-slate-400">{unitShort(product.unit)}</span>
            </label>
          ) : (
            <div className="mt-2 flex items-center justify-between rounded-2xl bg-slate-50 p-2">
              <button
                aria-label="Restar"
                className="flex size-14 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm transition active:scale-90 disabled:opacity-40"
                disabled={quantity <= ONE}
                onClick={() => step(-1)}
                type="button"
              >
                <Minus className="size-6" />
              </button>
              <span className="text-4xl font-black tabular-nums text-slate-950">{formatQuantity(quantity)}</span>
              <button
                aria-label="Sumar"
                className="flex size-14 items-center justify-center rounded-2xl bg-primary text-white shadow-sm transition active:scale-90"
                onClick={() => step(1)}
                type="button"
              >
                <Plus className="size-6" />
              </button>
            </div>
          )}

          {/* Atajos: el bulto del rubro y las cantidades que más se repiten. */}
          {!byWeight ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[2, 3, 6, 12].map((amount) => (
                <button
                  className="rounded-xl bg-slate-100 px-3.5 py-2.5 text-sm font-black text-slate-600 transition active:scale-95"
                  key={amount}
                  onClick={() => setQuantity(amount * ONE)}
                  type="button"
                >
                  {amount}
                </button>
              ))}
              {product.packSize && product.packSize > 1 ? (
                <button
                  className="rounded-xl bg-slate-900 px-3.5 py-2.5 text-sm font-black text-white transition active:scale-95"
                  onClick={() => setQuantity((product.packSize as number) * ONE)}
                  type="button"
                >
                  {product.packLabel ?? "Bulto"} ×{product.packSize}
                </button>
              ) : null}
            </div>
          ) : null}

          {alreadyInCart > 0 ? (
            <p className="mt-2 text-xs font-bold text-slate-500">
              Ya tenías {formatQuantity(alreadyInCart, product.unit)} en el pedido: quedan{" "}
              {formatQuantity(totalConCarrito, product.unit)}.
            </p>
          ) : null}

          {sinStock ? (
            <p className="mt-2 flex items-center gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm font-bold text-amber-700">
              <TriangleAlert className="size-4 shrink-0" />
              Te queda menos de lo que estás vendiendo.
            </p>
          ) : null}
        </div>

        <div className="mt-4 border-t border-slate-100 px-5 pt-4">
          <button
            className="flex w-full items-center justify-between gap-3 rounded-2xl bg-primary px-5 py-4 text-white transition active:scale-[0.99] disabled:bg-slate-200 disabled:text-slate-400"
            data-testid="scan-confirm"
            disabled={!puedeAgregar}
            onClick={() => onConfirm(quantity)}
            type="button"
          >
            <span className="flex items-center gap-2 text-base font-black">
              <Check className="size-5" />
              Agregar
            </span>
            <span className="text-xl font-black tabular-nums">{money(total)}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
