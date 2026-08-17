"use client";

import { Minus, Plus, Trash2 } from "@/components/icons";
import type { Unit } from "@/generated/prisma/enums";
import { formatQuantity, QUANTITY_SCALE } from "@/lib/quantity";

/**
 * El pedido, como lista.
 *
 * Reemplaza a la grilla de Syncfusion en los DOS lugares donde se muestra lo
 * que se está cobrando: la columna del mostrador y la hoja de confirmación del
 * cobro. Las dos son angostas —352px la columna, el ancho de un teléfono la
 * hoja— y esa grilla pide unos 280px solo para cantidad, total y borrar. Con lo
 * que sobra, el nombre del producto se queda sin lugar: en la columna el
 * encabezado se renderizaba en vertical, una letra por línea, y en el teléfono
 * el renglón directamente se rompía.
 *
 * Un solo componente para los dos lados a propósito. Antes de esto la lista
 * vivía suelta adentro de la columna, así que arreglar el teléfono habría sido
 * escribirla de nuevo — y la próxima corrección iba a entrar en una sola.
 */

export type PosCartListItem = {
  productId: string;
  name: string;
  price: number;
  unit: Unit;
  /** Milésimas de unidad (ver src/lib/quantity.ts). */
  quantity: number;
  imageSrc?: string | null;
};

const pesos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function PosCartList({
  items,
  onAdd,
  onDecrease,
  onRemove,
}: {
  items: PosCartListItem[];
  onAdd: (productId: string) => void;
  onDecrease: (productId: string) => void;
  onRemove: (productId: string) => void;
}) {
  return (
    <ul className="flex flex-col">
      {items.map((item) => {
        const unidades = item.quantity / QUANTITY_SCALE;
        return (
          <li
            className="flex items-center gap-2 rounded-lg px-1 py-1.5 transition hover:bg-slate-50"
            key={item.productId}
          >
            {item.imageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" className="size-8 shrink-0 rounded-md object-cover" src={item.imageSrc} />
            ) : null}

            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-black leading-tight text-slate-950">{item.name}</span>
              <span className="block text-xs font-bold tabular-nums text-slate-500">
                {pesos.format(item.price * unidades)}
              </span>
            </span>

            {/* Todo en UNA fila. Con los controles debajo del nombre cada
                producto gastaba 76px para decir "1": con doce productos se
                veían cuatro. */}
            <span className="flex shrink-0 items-center gap-1">
              <button
                // Con uno, bajar equivale a sacarlo: se evita el paso muerto de
                // dejarlo en cero para borrarlo después.
                aria-label={unidades <= 1 ? `Sacar ${item.name} del pedido` : `Quitar uno de ${item.name}`}
                className="grid size-8 place-items-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200 active:scale-90"
                onClick={() => (unidades <= 1 ? onRemove(item.productId) : onDecrease(item.productId))}
                type="button"
              >
                <Minus className="size-3.5" />
              </button>

              <span className="min-w-8 text-center text-sm font-black tabular-nums text-slate-950">
                {formatQuantity(item.quantity, item.unit)}
              </span>

              <button
                aria-label={`Agregar uno de ${item.name}`}
                className="grid size-8 place-items-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200 active:scale-90"
                onClick={() => onAdd(item.productId)}
                type="button"
              >
                <Plus className="size-3.5" />
              </button>

              {/* El tacho, SIEMPRE. El caso que lo justifica no es la cantidad
                  1 —ahí el "−" ya alcanza— sino la contraria: 20 unidades
                  cargadas por error son 20 toques para sacar el renglón. */}
              <button
                aria-label={`Sacar ${item.name} del pedido`}
                className="ml-0.5 grid size-8 place-items-center rounded-full text-slate-400 transition hover:bg-destructive/10 hover:text-destructive active:scale-90"
                onClick={() => onRemove(item.productId)}
                type="button"
              >
                <Trash2 className="size-3.5" />
              </button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
