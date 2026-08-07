"use client";

import { useEffect, useState, useTransition } from "react";

import { getProductAnalytics, type AnalisisDeProductoResult } from "@/app/catalog/actions";
import { Loader2 } from "@/components/icons";
import type { Unit } from "@/generated/prisma/client";
import { formatQuantity } from "@/lib/quantity";
import { PERIODO_LABELS, PERIODOS, type Periodo } from "@/modules/sales/sales-period.logic";

/**
 * Los números del producto: qué se vendió, qué costó y qué quedó.
 *
 * Se pide al servidor recién cuando se abre la pestaña. Son cuatro consultas
 * por producto: hacerlas al pintar el catálogo sería pagarlas sesenta veces
 * para algo que se mira de a uno.
 */

type Analisis = Extract<AnalisisDeProductoResult, { ok: true }>["analisis"];

const pesos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const fecha = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long" });

export function ProductAnalyticsTab({
  productId,
  activa,
  unidad,
  usaStock,
}: {
  productId: string;
  /** Solo consulta cuando la pestaña está a la vista. */
  activa: boolean;
  unidad: Unit;
  usaStock: boolean;
}) {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, startCarga] = useTransition();

  useEffect(() => {
    if (!activa) return;

    let vigente = true;
    startCarga(async () => {
      const resultado = await getProductAnalytics(productId, periodo);
      // Cambiar de período rápido dispara dos pedidos: si contesta primero el
      // viejo, pintaría números de un período que ya no es el elegido.
      if (!vigente) return;
      if (resultado.ok) {
        setAnalisis(resultado.analisis);
        setError(null);
      } else {
        setError(resultado.error);
      }
    });

    return () => {
      vigente = false;
    };
  }, [activa, periodo, productId]);

  // `formatQuantity` con unidad ya devuelve "4 un" / "1,5 kg". Abreviada como en
  // todo el resto: "4 Unidad" no lo dice nadie.
  const cantidad = (milesimas: number) => formatQuantity(milesimas, unidad);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {PERIODOS.map((opcion) => (
          <button
            className={`rounded-full px-3.5 py-1.5 text-sm font-black transition ${
              opcion === periodo ? "bg-slate-900 text-white" : "text-slate-500 ring-1 ring-slate-950/10"
            }`}
            key={opcion}
            onClick={() => setPeriodo(opcion)}
            type="button"
          >
            {PERIODO_LABELS[opcion]}
          </button>
        ))}
      </div>

      {error ? (
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700" role="alert">
          {error}
        </p>
      ) : null}

      {!analisis && cargando ? (
        <p className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-6 text-sm font-bold text-slate-500">
          <Loader2 className="size-4 animate-spin" />
          Sacando las cuentas…
        </p>
      ) : null}

      {analisis ? (
        <div className={`space-y-4 transition-opacity ${cargando ? "opacity-50" : ""}`}>
          {analisis.unidades === 0 && analisis.compradas === 0 && analisis.tiradas === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              Sin movimientos en este período.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-950/5 sm:grid-cols-4">
                <Dato etiqueta="Vendidas" valor={cantidad(analisis.unidades)} />
                <Dato destacado etiqueta="Facturado" valor={pesos.format(analisis.facturado)} />
                <Dato etiqueta="Costo" valor={pesos.format(analisis.costo)} />
                {/* El margen manda el color: es el número por el que se abre
                    esta pestaña, y en rojo se ve antes de leerlo. */}
                <Dato
                  etiqueta="Margen"
                  tono={analisis.margen < 0 ? "malo" : "bueno"}
                  valor={pesos.format(analisis.margen)}
                  nota={analisis.margenPorcentaje !== null ? `${analisis.margenPorcentaje}% de lo facturado` : undefined}
                />
              </div>

              <dl className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-950/5">
                <Fila etiqueta="Ventas en las que apareció" valor={String(analisis.ventas)} />
                <Fila
                  etiqueta="Última vez que se vendió"
                  valor={analisis.ultimaVenta ? fecha.format(new Date(analisis.ultimaVenta)) : "—"}
                />
                {analisis.descuentos > 0 ? (
                  <Fila etiqueta="Descuentos aplicados" valor={`−${pesos.format(analisis.descuentos)}`} />
                ) : null}
                {/* Solo si hubo: una fila en cero todos los días es ruido. */}
                {analisis.devueltas > 0 ? (
                  <Fila
                    etiqueta="Devueltas"
                    tono="malo"
                    valor={`${cantidad(analisis.devueltas)} · ${pesos.format(analisis.devuelto)}`}
                  />
                ) : null}
                {analisis.compradas > 0 ? (
                  <Fila
                    etiqueta="Compradas"
                    valor={`${cantidad(analisis.compradas)} · ${pesos.format(analisis.gastadoEnCompras)}`}
                  />
                ) : null}
                {analisis.ultimoCosto !== null ? (
                  <Fila etiqueta="Último costo pagado" valor={pesos.format(analisis.ultimoCosto)} />
                ) : null}
                {usaStock && analisis.tiradas > 0 ? (
                  <Fila
                    etiqueta="Tiradas (mermas)"
                    tono="malo"
                    valor={`${cantidad(analisis.tiradas)}${analisis.perdidoEnMermas > 0 ? ` · ${pesos.format(analisis.perdidoEnMermas)}` : ""}`}
                  />
                ) : null}
              </dl>

              <p className="text-xs text-slate-500">
                El costo es el que tenía cada venta el día que se hizo, no el de hoy: así el margen del mes
                pasado no cambia porque hoy subió un proveedor.
              </p>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Dato({
  etiqueta,
  valor,
  nota,
  destacado = false,
  tono = "normal",
}: {
  etiqueta: string;
  valor: string;
  nota?: string;
  destacado?: boolean;
  tono?: "normal" | "bueno" | "malo";
}) {
  return (
    <div className="bg-white px-4 py-3.5">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{etiqueta}</p>
      <p
        className={`font-display mt-0.5 text-2xl font-black tracking-tight ${
          tono === "malo" ? "text-rose-600" : tono === "bueno" ? "text-emerald-600" : destacado ? "text-primary" : "text-slate-950"
        }`}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {valor}
      </p>
      {nota ? <p className="mt-0.5 text-xs text-slate-500">{nota}</p> : null}
    </div>
  );
}

function Fila({ etiqueta, valor, tono = "normal" }: { etiqueta: string; valor: string; tono?: "normal" | "malo" }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <dt className="text-sm font-bold text-slate-500">{etiqueta}</dt>
      <dd
        className={`shrink-0 text-sm font-black ${tono === "malo" ? "text-rose-600" : "text-slate-950"}`}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {valor}
      </dd>
    </div>
  );
}
