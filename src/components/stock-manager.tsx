"use client";

import { useState } from "react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ProductStockPanel } from "@/components/product-stock-panel";
import { Package, Search, X } from "@/components/icons";
import type { Unit } from "@/generated/prisma/enums";
import { formatQuantity } from "@/lib/quantity";

/**
 * El depósito de una sucursal.
 *
 * Dos decisiones que cambian cómo se usa:
 *
 * 1. Lo que se VENDE y lo que se USA para producir van en pestañas separadas.
 *    Mezclados, la harina aparecía entre las medialunas y la lista dejaba de
 *    servir para las dos cosas: para reponer mercadería hay que mirar una, para
 *    controlar insumos la otra.
 *
 * 2. Cargar un movimiento es un MODAL sobre el producto que se tocó, no tres
 *    formularios sueltos al pie con su propio selector. Con el producto ya
 *    elegido no hay que buscarlo de nuevo en un combo de sesenta, y se reusa el
 *    mismo panel de la ficha: el que dice en cuánto va a quedar antes de
 *    confirmar.
 */

export type StockManagerRow = {
  productId: string;
  name: string;
  sku: string | null;
  unit: Unit;
  esInsumo: boolean;
  categoryName: string | null;
  quantity: number;
  minStock: number | null;
  cost: number | null;
  stockValue: number;
  status: "ok" | "low" | "out";
};

export type StockManagerMovement = {
  id: string;
  productName: string;
  unit: Unit;
  quantity: number;
  typeLabel: string;
  reason: string | null;
  when: string;
};

const dinero = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function StockManager({
  rows,
  movements,
  branchId,
  branchName,
  catalogPlural,
}: {
  rows: StockManagerRow[];
  movements: StockManagerMovement[];
  branchId: string;
  branchName: string;
  catalogPlural: string;
}) {
  const insumos = rows.filter((row) => row.esInsumo);
  const vendibles = rows.filter((row) => !row.esInsumo);

  const [tab, setTab] = useState<"vendibles" | "insumos" | "movimientos">("vendibles");
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);

  const pestanas: { key: typeof tab; label: string; cantidad: number }[] = [
    { key: "vendibles", label: catalogPlural, cantidad: vendibles.length },
    // Sin insumos cargados la pestaña no aparece: una lista vacía permanente es
    // una promesa de algo que este negocio no usa.
    ...(insumos.length > 0 ? [{ key: "insumos" as const, label: "Insumos", cantidad: insumos.length }] : []),
    { key: "movimientos", label: "Movimientos", cantidad: movements.length },
  ];

  const listado = tab === "insumos" ? insumos : vendibles;
  const normalizar = (valor: string) =>
    valor
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
  const consulta = normalizar(busqueda.trim());
  const visibles = consulta
    ? listado.filter((row) => [row.name, row.sku ?? ""].some((campo) => normalizar(campo).includes(consulta)))
    : listado;

  const elegido = rows.find((row) => row.productId === abierto) ?? null;

  return (
    <>
      <div className="flex gap-2 border-b border-slate-200">
        {pestanas.map((pestana) => (
          <button
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 pb-2.5 text-sm font-black transition ${
              tab === pestana.key
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
            key={pestana.key}
            onClick={() => setTab(pestana.key)}
            type="button"
          >
            {pestana.label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs ${
                tab === pestana.key ? "bg-primary/10" : "bg-slate-100 text-slate-500"
              }`}
            >
              {pestana.cantidad}
            </span>
          </button>
        ))}
      </div>

      {tab === "movimientos" ? (
        <MovimientosLista movements={movements} />
      ) : (
        <>
          {listado.length > 6 ? (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-3 text-base font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/15"
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Buscar por nombre o código…"
                value={busqueda}
              />
            </div>
          ) : null}

          {visibles.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              {consulta
                ? "No encontramos nada con eso."
                : tab === "insumos"
                  ? "Todavía no hay insumos con control de stock."
                  : "Ningún producto lleva control de stock todavía."}
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-950/5">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 text-left">
                    <Th>Producto</Th>
                    <Th>Existencia</Th>
                    <Th>Mínimo</Th>
                    <Th alineado="derecha">Costo</Th>
                    <Th alineado="derecha">Valorizado</Th>
                    <Th alineado="derecha">Mover</Th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((row) => (
                    <tr className="border-b border-slate-50 last:border-0" key={row.productId}>
                      <td className="w-full max-w-0 px-4 py-3">
                        <p className="truncate text-sm font-bold text-slate-950">{row.name}</p>
                        <p className="truncate text-xs text-slate-500">
                          {row.categoryName ?? "Sin categoría"}
                          {row.sku ? ` · ${row.sku}` : ""}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${
                            row.status === "out"
                              ? "bg-rose-50 text-rose-700"
                              : row.status === "low"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {row.status === "out" ? "Sin stock" : formatQuantity(row.quantity, row.unit)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">
                        {row.minStock !== null ? formatQuantity(row.minStock, row.unit) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-500">
                        {row.cost ? dinero.format(row.cost) : "—"}
                      </td>
                      <td
                        className="whitespace-nowrap px-4 py-3 text-right text-sm font-black text-slate-800"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {dinero.format(row.stockValue)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {/* Se opera desde la fila: el producto ya está elegido y
                            no hay que volver a buscarlo en un combo. */}
                        <button
                          className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 transition active:scale-95 hover:bg-slate-200"
                          onClick={() => setAbierto(row.productId)}
                          type="button"
                        >
                          Cargar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <BottomSheet onClose={() => setAbierto(null)} open={elegido !== null} size="dialog">
        {elegido ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-4">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">Mover stock</p>
                <h3 className="truncate text-xl font-black tracking-tight text-slate-950">{elegido.name}</h3>
              </div>
              <button
                aria-label="Cerrar"
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-90"
                onClick={() => setAbierto(null)}
                type="button"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
              {/* El mismo panel que la ficha del producto: una sola forma de
                  mover stock en toda la app, con la vista previa que dice en
                  cuánto va a quedar antes de confirmar. */}
              <ProductStockPanel
                branchId={branchId}
                branchName={branchName}
                minStock={elegido.minStock}
                productId={elegido.productId}
                quantity={elegido.quantity}
                unit={elegido.unit}
              />
            </div>
          </div>
        ) : null}
      </BottomSheet>
    </>
  );
}

function MovimientosLista({ movements }: { movements: StockManagerMovement[] }) {
  if (movements.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Todavía no hay movimientos en esta sucursal.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-950/5">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-100 text-left">
            <Th>Cuándo</Th>
            <Th>Producto</Th>
            <Th>Qué pasó</Th>
            <Th alineado="derecha">Movimiento</Th>
          </tr>
        </thead>
        <tbody>
          {movements.map((movement) => (
            <tr className="border-b border-slate-50 last:border-0" key={movement.id}>
              <td className="whitespace-nowrap px-4 py-3 text-sm font-bold text-slate-500">{movement.when}</td>
              <td className="w-full max-w-0 truncate px-4 py-3 text-sm font-bold text-slate-950">
                {movement.productName}
              </td>
              <td className="px-4 py-3 text-sm text-slate-500">
                {movement.typeLabel}
                {movement.reason ? ` · ${movement.reason}` : ""}
              </td>
              {/* Con signo y color: de un vistazo se ve qué entró y qué salió,
                  que es para lo que se abre esta lista. */}
              <td
                className={`whitespace-nowrap px-4 py-3 text-right text-sm font-black ${
                  movement.quantity >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {movement.quantity >= 0 ? "+" : "−"}
                {formatQuantity(Math.abs(movement.quantity), movement.unit)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, alineado = "izquierda" }: { children: React.ReactNode; alineado?: "izquierda" | "derecha" }) {
  return (
    <th
      className={`px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-600 ${
        alineado === "derecha" ? "text-right" : ""
      }`}
      scope="col"
    >
      {children}
    </th>
  );
}

export function StockEmpty() {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
      <Package className="mb-3 size-8 text-slate-300" />
      <p className="text-sm font-bold text-slate-600">Ningún producto lleva control de stock</p>
      <p className="mt-1 text-xs text-slate-500">
        Marcalo como producto físico en su ficha para empezar a contarlo.
      </p>
    </div>
  );
}
