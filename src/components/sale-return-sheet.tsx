"use client";

import { getReturnableLines, registerReturn, type ReturnableLine } from "@/app/sales/return-actions";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Check, Loader2, Minus, Plus, X } from "@/components/icons";
import type { PaymentMethod } from "@/generated/prisma/enums";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ORDER } from "@/lib/payment-labels";
import type { Unit } from "@/generated/prisma/enums";
import { allowsFraction, formatQuantity, ONE, parseQuantityInput } from "@/lib/quantity";
import { useEffect, useState, useTransition } from "react";

// Devolución parcial: el cliente trae parte de lo que compró.
//
// Lo que se ofrece devolver es lo que QUEDA (descontando devoluciones previas),
// no lo que se vendió: si ya trajo una remera, la segunda vez solo puede traer
// las otras dos.

type SaleReturnSheetProps = {
  saleId: string | null;
  onClose: () => void;
  onDone: () => void;
};

export function SaleReturnSheet({ saleId, onClose, onDone }: SaleReturnSheetProps) {
  const [lines, setLines] = useState<ReturnableLine[] | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<string>("CASH");
  const [hasCustomer, setHasCustomer] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!saleId) {
      setLines(null);
      setQuantities({});
      setReason("");
      setError(null);
      return;
    }

    let cancelled = false;

    void getReturnableLines(saleId).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setLines(result.lines);
        setHasCustomer(result.hasCustomer);
      } else {
        setError(result.error);
        setLines([]);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [saleId]);

  const total = lines?.length ?? 0;
  const chosen = Object.values(quantities).filter((quantity) => quantity > 0).length;

  function setQuantity(line: ReturnableLine, next: number) {
    const clamped = Math.max(0, Math.min(next, line.pending));
    setQuantities((current) => ({ ...current, [line.saleItemId]: clamped }));
  }

  function submit() {
    if (!saleId) return;
    setError(null);

    startTransition(async () => {
      const result = await registerReturn({
        saleId,
        lines: Object.entries(quantities).map(([saleItemId, quantity]) => ({ saleItemId, quantity })),
        method: method as PaymentMethod,
        reason: reason.trim() || undefined,
      });

      if (result.ok) {
        onDone();
      } else {
        setError(result.error);
      }
    });
  }

  // "A cuenta" solo aparece si la venta tiene cliente: si no, no hay a quién
  // acreditarle la plata.
  const methods = hasCustomer ? [...PAYMENT_METHOD_ORDER, "ACCOUNT" as PaymentMethod] : PAYMENT_METHOD_ORDER;

  return (
    <BottomSheet onClose={onClose} open={saleId !== null} panelClassName="min-h-[70dvh]">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3 px-5 pt-6">
          <div>
            <h3 className="text-xl font-black tracking-tight text-slate-950">Devolver</h3>
            <p className="text-sm text-slate-500">Elegí qué trae el cliente. El stock vuelve solo.</p>
          </div>
          <button
            aria-label="Cerrar"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:scale-90"
            onClick={onClose}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pt-5">
          {lines === null ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : total === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
              {error ?? "Ya se devolvió todo lo de esta venta."}
            </p>
          ) : (
            lines.map((line) => {
              const quantity = quantities[line.saleItemId] ?? 0;
              const byWeight = allowsFraction(line.unit as Unit);

              return (
                <div className="rounded-2xl bg-slate-50 p-3.5" key={line.saleItemId}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-950">{line.description}</p>
                      <p className="text-xs text-slate-500">
                        Quedan {formatQuantity(line.pending, line.unit as Unit)} por devolver
                      </p>
                    </div>
                    {byWeight ? (
                      <input
                        aria-label={`Cantidad a devolver de ${line.description}`}
                        className="w-24 rounded-xl border border-slate-200 bg-white px-2 py-2 text-right text-sm font-black"
                        inputMode="decimal"
                        onChange={(event) =>
                          setQuantity(line, parseQuantityInput(event.target.value, line.unit as Unit) ?? 0)
                        }
                        placeholder="0"
                        value={quantity ? formatQuantity(quantity) : ""}
                      />
                    ) : (
                      <div className="flex shrink-0 items-center rounded-full bg-white p-1 ring-1 ring-slate-950/5">
                        <button
                          aria-label={`Restar ${line.description}`}
                          className="flex size-8 items-center justify-center rounded-full text-slate-600 transition active:scale-90"
                          onClick={() => setQuantity(line, quantity - ONE)}
                          type="button"
                        >
                          <Minus className="size-4" />
                        </button>
                        <span className="w-8 text-center text-sm font-black">{formatQuantity(quantity)}</span>
                        <button
                          aria-label={`Sumar ${line.description}`}
                          className="flex size-8 items-center justify-center rounded-full text-slate-600 transition active:scale-90"
                          onClick={() => setQuantity(line, quantity + ONE)}
                          type="button"
                        >
                          <Plus className="size-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {total > 0 ? (
            <>
              <label className="grid gap-2 pt-2 text-xs font-black uppercase tracking-wide text-slate-500">
                ¿Cómo se le devuelve?
                <select
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none"
                  onChange={(event) => setMethod(event.target.value)}
                  value={method}
                >
                  {methods.map((option) => (
                    <option key={option} value={option}>
                      {option === "ACCOUNT" ? "A cuenta del cliente" : PAYMENT_METHOD_LABELS[option]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                Motivo (opcional)
                <input
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none"
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Le quedaba chico"
                  value={reason}
                />
              </label>
            </>
          ) : null}

          {error && total > 0 ? <p className="text-sm font-bold text-rose-600">{error}</p> : null}
        </div>

        {total > 0 ? (
          <div className="mt-auto border-t border-slate-100 px-5 pb-1 pt-4">
            <button
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-4 text-base font-black text-white transition active:scale-[0.99] disabled:bg-slate-200 disabled:text-slate-400"
              disabled={chosen === 0 || isPending}
              onClick={submit}
              type="button"
            >
              {isPending ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
              Confirmar devolución
            </button>
          </div>
        ) : null}
      </div>
    </BottomSheet>
  );
}
