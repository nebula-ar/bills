"use client";

import { useEffect, useState, useTransition } from "react";

import { getProductStockMovements, type MovimientoDeFicha } from "@/app/catalog/actions";
import { Loader2 } from "@/components/icons";
import type { Unit } from "@/generated/prisma/enums";
import { formatQuantity, unitLabel } from "@/lib/quantity";
import { autorDe, leerMovimiento, signoDe } from "@/modules/stock/movimiento-label.logic";

// Últimos movimientos de stock del producto.
//
// Contesta la pregunta que aparece cuando un número no cuadra: "¿de dónde
// salieron estas 24 unidades?". Sin esto, el stock es un número sin historia y
// la única forma de entenderlo es acordarse.
//
// Se pide recién cuando la pestaña está a la vista (`activa`): abrir una ficha
// para tocar el precio no tiene por qué pagar una consulta al historial.

export function ProductMovements({
  activa,
  branchId,
  productId,
  unidad,
}: {
  activa: boolean;
  branchId: string;
  productId: string;
  unidad: Unit;
}) {
  const [movimientos, setMovimientos] = useState<MovimientoDeFicha[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, empezar] = useTransition();

  useEffect(() => {
    if (!activa || movimientos !== null || cargando) return;

    empezar(async () => {
      const resultado = await getProductStockMovements(productId, branchId);
      if (resultado.ok) setMovimientos(resultado.movimientos);
      else setError(resultado.error);
    });
  }, [activa, branchId, cargando, movimientos, productId]);

  if (!activa) return null;

  return (
    <section className="grid gap-2">
      <p className="text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500">Movimientos recientes</p>

      {error ? <p className="text-sm font-bold text-rose-600">{error}</p> : null}

      {movimientos === null && !error ? (
        <p className="flex items-center gap-2 py-3 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" />
          Buscando…
        </p>
      ) : null}

      {/* Vacío no es error: un producto recién cargado no tiene historia
          todavía, y decirlo así evita que parezca que algo falló. */}
      {movimientos?.length === 0 ? (
        <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
          Todavía no hay movimientos de este producto.
        </p>
      ) : null}

      {movimientos && movimientos.length > 0 ? (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl ring-1 ring-slate-950/5">
          {movimientos.map((movimiento) => (
            <Renglon key={movimiento.id} movimiento={movimiento} unidad={unidad} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Renglon({ movimiento, unidad }: { movimiento: MovimientoDeFicha; unidad: Unit }) {
  const lectura = leerMovimiento(movimiento.type);
  const signo = signoDe(movimiento.quantity);
  const autor = autorDe(movimiento.autor);
  const entra = movimiento.quantity > 0;

  return (
    <li className="flex items-center gap-3 bg-white px-3 py-2.5">
      {/* La cantidad primero y con su signo: es el dato que se viene a buscar.
          El color refuerza lo que el signo ya dice, no lo reemplaza — quien no
          distingue verde de rojo lee el "+" igual. */}
      <span
        className={`shrink-0 rounded-lg px-2 py-1 text-sm font-black ${
          entra ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
        }`}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {signo}
        {formatQuantity(Math.abs(movimiento.quantity))}{" "}
        <span className="font-bold opacity-70">{unitLabel(unidad).toLowerCase()}</span>
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-slate-950">{lectura.titulo}</p>
        {/* El motivo del ajuste, si lo escribieron: "conteo del lunes" explica
            un -3 que el tipo de movimiento solo. */}
        {movimiento.reason || autor ? (
          <p className="truncate text-xs text-slate-500">
            {[movimiento.reason, autor].filter(Boolean).join(" · ")}
          </p>
        ) : null}
      </div>

      <time className="shrink-0 text-xs font-semibold text-slate-400" dateTime={movimiento.occurredAt}>
        {cuando(movimiento.occurredAt)}
      </time>
    </li>
  );
}

/**
 * "Hoy 14:32" en vez de la fecha completa cuando es de hoy o de ayer: en un
 * historial reciente, lo que importa es hace cuánto, y "15/08 14:32" obliga a
 * hacer la cuenta mental.
 */
function cuando(iso: string) {
  const fecha = new Date(iso);
  const hora = fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  const hoy = new Date();
  const mismoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  if (mismoDia(fecha, hoy)) return `Hoy ${hora}`;

  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);
  if (mismoDia(fecha, ayer)) return `Ayer ${hora}`;

  return fecha.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}
