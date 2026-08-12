"use client";

import { useMemo, useState } from "react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { SelectField } from "@/components/ui/select-field";
import { ProductStockPanel } from "@/components/product-stock-panel";
import { Package, Plus, Search, TriangleAlert, X } from "@/components/icons";
import type { Unit } from "@/generated/prisma/enums";
import { formatQuantity } from "@/lib/quantity";
import { productImageSrc } from "@/modules/catalog/product-image-src.logic";

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
 *    confirmar. El botón "+ Movimiento" de arriba abre el mismo modal, solo
 *    que primero pregunta cuál —para cuando no se está mirando la fila.
 */

export type StockManagerRow = {
  productId: string;
  name: string;
  sku: string | null;
  unit: Unit;
  esInsumo: boolean;
  categoryName: string | null;
  imageVersion: number | null;
  catalogSlug: string | null;
  quantity: number;
  minStock: number | null;
  cost: number | null;
  stockValue: number;
  status: "ok" | "low" | "out";
};

export type StockManagerMovement = {
  id: string;
  productId: string;
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

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

type Filtro = "todos" | "sin-stock" | "bajo-minimo" | "mas-movidos";

const ESTADO_TONO: Record<StockManagerRow["status"], { badge: string; boton: string; icono: string }> = {
  out: { badge: "bg-rose-50 text-rose-700", boton: "bg-rose-100 text-rose-700 hover:bg-rose-200", icono: "bg-rose-100 text-rose-600" },
  low: { badge: "bg-amber-50 text-amber-700", boton: "bg-amber-100 text-amber-700 hover:bg-amber-200", icono: "bg-amber-100 text-amber-600" },
  ok: { badge: "bg-emerald-50 text-emerald-700", boton: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200", icono: "bg-emerald-100 text-emerald-600" },
};

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
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");
  // string = producto elegido (fila "Cargar"). "elegir" = se abrió desde
  // "+ Movimiento" y todavía no se sabe cuál.
  const [abierto, setAbierto] = useState<string | "elegir" | null>(null);
  const [productoAElegir, setProductoAElegir] = useState("");

  const pestanas: { key: typeof tab; label: string; cantidad: number }[] = [
    { key: "vendibles", label: catalogPlural, cantidad: vendibles.length },
    // Sin insumos cargados la pestaña no aparece: una lista vacía permanente es
    // una promesa de algo que este negocio no usa.
    ...(insumos.length > 0 ? [{ key: "insumos" as const, label: "Insumos", cantidad: insumos.length }] : []),
    { key: "movimientos", label: "Movimientos", cantidad: movements.length },
  ];

  // Cuántas veces se movió cada producto, de lo más reciente que ya está en
  // pantalla: no es una consulta nueva, es contar lo que `movements` ya trae.
  const movidasPorProducto = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const m of movements) mapa[m.productId] = (mapa[m.productId] ?? 0) + 1;
    return mapa;
  }, [movements]);

  const sinStock = rows.filter((row) => row.status === "out");

  const listadoBase = tab === "insumos" ? insumos : vendibles;

  const porFiltro = useMemo(() => {
    if (filtro === "sin-stock") return listadoBase.filter((row) => row.status === "out");
    if (filtro === "bajo-minimo") return listadoBase.filter((row) => row.status === "low" || row.status === "out");
    if (filtro === "mas-movidos") {
      return listadoBase
        .filter((row) => (movidasPorProducto[row.productId] ?? 0) > 0)
        .sort((a, b) => (movidasPorProducto[b.productId] ?? 0) - (movidasPorProducto[a.productId] ?? 0));
    }
    return listadoBase;
  }, [listadoBase, filtro, movidasPorProducto]);

  const consulta = normalizar(busqueda.trim());
  const visibles = consulta
    ? porFiltro.filter((row) => [row.name, row.sku ?? ""].some((campo) => normalizar(campo).includes(consulta)))
    : porFiltro;

  const elegido = rows.find((row) => row.productId === abierto) ?? null;

  return (
    <>
      {/* gap-5 entre bloques: el banner, la fila de pestañas, el buscador+chips
          y la lista son partes distintas de la pantalla, no una sola cosa. Sin
          este contenedor cada uno terminaba pegado al de al lado. */}
      <div className="flex flex-col gap-5">
      {sinStock.length > 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-rose-50 px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-600">
              <TriangleAlert className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-black text-rose-900">
                {sinStock.length} {sinStock.length === 1 ? "producto sin stock" : "productos sin stock"}
              </p>
              <p className="truncate text-xs text-rose-700">{sinStock.map((row) => row.name).join(", ")}</p>
            </div>
          </div>
          <button
            className="shrink-0 text-sm font-black text-rose-700 hover:underline"
            onClick={() => setFiltro("sin-stock")}
            type="button"
          >
            Ver productos →
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200">
        <div className="flex gap-2">
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

        {tab !== "movimientos" ? (
          <button
            className="mb-1.5 flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-xs font-black text-white shadow-sm shadow-primary/25 transition active:scale-95 hover:bg-primary-strong"
            onClick={() => {
              setAbierto("elegir");
              setProductoAElegir("");
            }}
            type="button"
          >
            <Plus className="size-4" />
            Movimiento
          </button>
        ) : null}
      </div>

      {tab === "movimientos" ? (
        <MovimientosLista movements={movements} />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-3 text-base font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/15"
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar producto..."
              value={busqueda}
            />
          </div>

          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(
              [
                ["todos", "Todos"],
                ["sin-stock", "Sin stock"],
                ["bajo-minimo", "Bajo mínimo"],
                ["mas-movidos", "Más movidos"],
              ] as [Filtro, string][]
            ).map(([valor, etiqueta]) => (
              <button
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${
                  filtro === valor ? "bg-primary text-white" : "bg-white text-slate-600 ring-1 ring-slate-950/5"
                }`}
                key={valor}
                onClick={() => setFiltro(valor)}
                type="button"
              >
                {etiqueta}
              </button>
            ))}
          </div>

          {visibles.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              {consulta
                ? "No encontramos nada con eso."
                : filtro !== "todos"
                  ? "Nada con ese filtro."
                  : tab === "insumos"
                    ? "Todavía no hay insumos con control de stock."
                    : "Ningún producto lleva control de stock todavía."}
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {visibles.map((row) => {
                const tono = ESTADO_TONO[row.status];
                const foto = productImageSrc({
                  id: row.productId,
                  imageVersion: row.imageVersion,
                  catalogSlug: row.catalogSlug,
                });
                return (
                  <li
                    className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-950/5"
                    key={row.productId}
                  >
                    {foto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt=""
                        className={`size-11 shrink-0 rounded-full object-cover ring-2 ${
                          row.status === "out"
                            ? "ring-rose-100"
                            : row.status === "low"
                              ? "ring-amber-100"
                              : "ring-emerald-100"
                        }`}
                        loading="lazy"
                        src={foto}
                      />
                    ) : (
                      <span className={`grid size-11 shrink-0 place-items-center rounded-full ${tono.icono}`}>
                        <Package className="size-5" />
                      </span>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-black text-slate-950">{row.name}</p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${tono.badge}`}>
                          {row.status === "out" ? "Sin stock" : row.status === "low" ? "Bajo mínimo" : "En stock"}
                        </span>
                      </div>
                      <p className="truncate text-xs text-slate-500">{row.categoryName ?? "Sin categoría"}</p>
                    </div>

                    <div className="hidden shrink-0 text-right sm:block">
                      <p
                        className={`text-sm font-black ${row.status === "out" ? "text-rose-600" : "text-slate-950"}`}
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {formatQuantity(row.quantity, row.unit)}
                      </p>
                      <p className="text-xs text-slate-500">
                        Mín. {row.minStock !== null ? formatQuantity(row.minStock, row.unit) : "—"}
                        {row.cost ? ` · ${dinero.format(row.cost)} c/u` : ""}
                      </p>
                    </div>

                    <button
                      className={`shrink-0 rounded-xl px-3.5 py-2.5 text-xs font-black transition active:scale-95 ${tono.boton}`}
                      onClick={() => setAbierto(row.productId)}
                      type="button"
                    >
                      + Cargar
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      </div>

      <BottomSheet onClose={() => setAbierto(null)} open={abierto !== null} size="dialog">
        {abierto === "elegir" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-3 pt-4">
              <h3 className="text-xl font-black tracking-tight text-slate-950">¿Qué producto?</h3>
              <button
                aria-label="Cerrar"
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-90"
                onClick={() => setAbierto(null)}
                type="button"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-5">
              <SelectField
                ariaLabel="Producto"
                onChange={setProductoAElegir}
                options={rows.map((row) => ({ value: row.productId, label: row.name }))}
              />
              <button
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-black text-white shadow-sm shadow-primary/25 transition active:scale-[0.99] disabled:opacity-50"
                disabled={!productoAElegir}
                onClick={() => setAbierto(productoAElegir)}
                type="button"
              >
                Continuar
              </button>
            </div>
          </div>
        ) : elegido ? (
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
