"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  previewProduction,
  registerProduction,
  type PreviewDeProduccion,
} from "@/app/catalog/production-actions";
import { Check, Loader2 } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import type { Unit } from "@/generated/prisma/client";
import { formatQuantity, unitShort } from "@/lib/quantity";

/**
 * Registrar una tanda: qué se hizo, cuántas, y qué se va a descontar.
 *
 * Vivía en `/produccion`, que registraba de una: elegías producto, ponías un
 * número y el stock se movía sin mostrar nada. Acá el resumen se calcula
 * mientras se tipea y la confirmación es un segundo paso.
 *
 * Producir no se puede anular —habría que compensar a mano cada movimiento— así
 * que ver antes de apretar no es un lujo: es la única oportunidad de darse
 * cuenta del error.
 */

const pesos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export type ProducibleRow = { id: string; name: string };

export function ProductionSheet({
  open,
  onClose,
  branchId,
  producibles,
}: {
  open: boolean;
  onClose: () => void;
  branchId: string;
  /** Solo los que tienen receta: sin receta no hay insumos que descontar. */
  producibles: ProducibleRow[];
}) {
  const router = useRouter();
  const [productId, setProductId] = useState("");
  const [unidades, setUnidades] = useState("12");
  const [preview, setPreview] = useState<PreviewDeProduccion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calculando, startCalculo] = useTransition();
  const [guardando, startGuardado] = useTransition();

  const cantidad = Number(unidades);
  const cantidadValida = Number.isInteger(cantidad) && cantidad > 0;
  const elegido = producibles.find((producible) => producible.id === productId) ?? null;

  useEffect(() => {
    if (!open) {
      setProductId("");
      setUnidades("12");
      setPreview(null);
      setError(null);
    }
  }, [open]);

  // El resumen se recalcula al cambiar producto o cantidad: es lo que convierte
  // "poné un número" en "esto es lo que te va a sacar del depósito".
  useEffect(() => {
    if (!open || !productId || !cantidadValida) {
      setPreview(null);
      return;
    }

    let vigente = true;
    startCalculo(async () => {
      const resultado = await previewProduction({ productId, branchId, unidades: cantidad });
      // Tipear rápido dispara varios pedidos: si contesta primero uno viejo,
      // pintaría el consumo de otra cantidad.
      if (!vigente) return;
      if (resultado.ok) {
        setPreview(resultado.preview);
        setError(null);
      } else {
        setPreview(null);
        setError(resultado.error);
      }
    });

    return () => {
      vigente = false;
    };
  }, [open, productId, branchId, cantidad, cantidadValida]);

  function confirmar() {
    if (!elegido || !cantidadValida) return;

    setError(null);
    startGuardado(async () => {
      const resultado = await registerProduction({
        productId: elegido.id,
        branchId,
        unidades: cantidad,
        nombre: elegido.name,
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      onClose();
      // La existencia cambió en los insumos Y en el producto terminado: la
      // lista de atrás sale del árbol del servidor y sin esto muestra los
      // números de antes (AGENTS.md).
      router.refresh();
    });
  }

  return (
    <BottomSheet onClose={onClose} open={open} size="dialog">
      <div className="grid gap-4 px-5 pb-2 pt-2">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-950">Registrar producción</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Se suma lo que hiciste y se descuentan los insumos que consumió.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="grid gap-1.5 text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500">
            Qué hiciste
            <select
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none focus:border-primary/40 focus:bg-white"
              onChange={(evento) => setProductId(evento.target.value)}
              value={productId}
            >
              <option value="">Elegí un producto</option>
              {producibles.map((producible) => (
                <option key={producible.id} value={producible.id}>
                  {producible.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500">
            Cuántas
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none focus:border-primary/40 focus:bg-white sm:w-28"
              inputMode="numeric"
              min={1}
              onChange={(evento) => setUnidades(evento.target.value)}
              type="number"
              value={unidades}
            />
          </label>
        </div>

        {error ? (
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>
        ) : null}

        {calculando && !preview ? (
          <p className="flex items-center gap-2 py-4 text-sm font-semibold text-slate-500">
            <Loader2 className="size-4 animate-spin" />
            Calculando qué consume…
          </p>
        ) : null}

        {preview ? (
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-950/5">
              <Dato etiqueta="Te sale" valor={pesos.format(preview.costo)} />
              <Dato
                etiqueta="Con lo que hay"
                tono={preview.alcanza ? undefined : "malo"}
                valor={`alcanza para ${preview.alcanzaPara}`}
              />
            </div>

            {/* El detalle es el punto de toda la pantalla: qué sale del
                depósito. Se muestra por insumo y no como un total, porque el
                error que se busca cazar es "cargué 600 en vez de 60" y eso solo
                se ve mirando la cantidad de harina. */}
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl ring-1 ring-slate-950/5">
              {preview.renglones.map((renglon) => (
                <li className="flex items-center justify-between gap-3 bg-white px-4 py-2.5" key={renglon.ingredienteId}>
                  <span className="min-w-0 truncate text-sm font-bold text-slate-950">{renglon.nombre}</span>
                  <span className="shrink-0 text-right">
                    <span
                      className={`block text-sm font-black ${renglon.falta > 0 ? "text-rose-600" : "text-slate-950"}`}
                    >
                      −{formatQuantity(renglon.consume, renglon.unit as Unit)} {unitShort(renglon.unit as Unit)}
                    </span>
                    <span className="block text-[0.6875rem] font-semibold text-slate-500">
                      {renglon.falta > 0
                        ? `faltan ${formatQuantity(renglon.falta, renglon.unit as Unit)}`
                        : `quedan ${formatQuantity(renglon.hay - renglon.consume, renglon.unit as Unit)}`}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pb-2">
          <button
            className="rounded-2xl px-4 py-3 text-sm font-black text-slate-500 transition hover:bg-slate-50"
            onClick={onClose}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white transition active:scale-95 disabled:opacity-50"
            // Sin resumen no se confirma: el botón existe para aceptar lo que se
            // está mirando, y si no hay nada que mirar es un "registrar a
            // ciegas" con otro nombre.
            disabled={guardando || !preview || !preview.alcanza}
            onClick={confirmar}
            type="button"
          >
            {guardando ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Confirmar
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

function Dato({ etiqueta, valor, tono }: { etiqueta: string; valor: string; tono?: "malo" }) {
  return (
    <div className="bg-white px-4 py-3">
      <p className="text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500">{etiqueta}</p>
      <p
        className={`mt-0.5 text-lg font-black ${tono === "malo" ? "text-rose-600" : "text-slate-950"}`}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {valor}
      </p>
    </div>
  );
}
