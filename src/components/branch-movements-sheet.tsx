"use client";

import { useEffect, useState, useTransition } from "react";

import { getBranchStockMovements, type MovimientoDeSucursal } from "@/app/catalog/stock-actions";
import { Loader2 } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import type { Unit } from "@/generated/prisma/client";
import { formatQuantity } from "@/lib/quantity";

/**
 * Qué se movió en esta sucursal, cruzando todos los productos.
 *
 * Vivía en `/stock`. Es lo único de esa pantalla que no cabe en un producto: la
 * ficha muestra los movimientos de uno, y revisar producto por producto no es
 * un control, es una auditoría. Acá se lee de corrido y se nota lo raro —una
 * salida que nadie explica— que de a uno se pierde.
 */

const fechaHora = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function BranchMovementsSheet({
  open,
  onClose,
  branchId,
  branchName,
}: {
  open: boolean;
  onClose: () => void;
  branchId: string;
  branchName: string;
}) {
  const [movimientos, setMovimientos] = useState<MovimientoDeSucursal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, startCarga] = useTransition();

  useEffect(() => {
    if (!open) return;

    let vigente = true;
    startCarga(async () => {
      const resultado = await getBranchStockMovements(branchId);
      // Cambiar de sucursal con la hoja abierta dispara dos pedidos: si contesta
      // primero el viejo, pintaría los movimientos de la otra.
      if (!vigente) return;
      if (resultado.ok) {
        setMovimientos(resultado.movimientos);
        setError(null);
      } else {
        setError(resultado.error);
      }
    });

    return () => {
      vigente = false;
    };
  }, [open, branchId]);

  return (
    <BottomSheet onClose={onClose} open={open} size="dialog">
      <div className="grid gap-4 px-5 pb-4 pt-2">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-950">Movimientos</h2>
          <p className="mt-0.5 text-sm text-slate-500">Lo último que entró y salió en {branchName}.</p>
        </div>

        {error ? (
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>
        ) : null}

        {cargando && !movimientos ? (
          <p className="flex items-center gap-2 py-8 text-sm font-semibold text-slate-500">
            <Loader2 className="size-4 animate-spin" />
            Buscando los movimientos…
          </p>
        ) : null}

        {movimientos && movimientos.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            Todavía no se movió nada acá.
          </p>
        ) : null}

        {movimientos && movimientos.length > 0 ? (
          <ul className="max-h-[60dvh] divide-y divide-slate-100 overflow-y-auto rounded-2xl ring-1 ring-slate-950/5">
            {movimientos.map((movimiento) => (
              <li className="flex items-start justify-between gap-3 bg-white px-4 py-3" key={movimiento.id}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-950">{movimiento.productName}</p>
                  <p className="mt-0.5 text-xs font-semibold text-slate-500">
                    {movimiento.typeLabel}
                    {movimiento.reason ? ` · ${movimiento.reason}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {/* El signo va acá y no en el tipo: "Ajuste" no dice si sumó o
                      restó, y es lo primero que se busca al recorrer la lista. */}
                  <p
                    className={`text-sm font-black ${
                      movimiento.quantity < 0 ? "text-rose-600" : "text-emerald-700"
                    }`}
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {movimiento.quantity > 0 ? "+" : "−"}
                    {formatQuantity(Math.abs(movimiento.quantity), movimiento.unit as Unit)}
                  </p>
                  <p className="text-[0.6875rem] font-semibold text-slate-500">
                    {fechaHora.format(new Date(movimiento.whenTs))}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </BottomSheet>
  );
}
