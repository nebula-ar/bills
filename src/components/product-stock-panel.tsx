"use client";

import { applyProductStockAction, type StockOp } from "@/app/catalog/stock-actions";
import { Check, Loader2, Package } from "@/components/icons";
import type { Unit } from "@/generated/prisma/enums";
import { formatQuantity, parseQuantityInput, unitShort } from "@/lib/quantity";
import { useState, useTransition } from "react";
import { toast } from "sonner";

// La existencia del producto, dentro de su propia ficha.
//
// Antes había que salir a la pantalla de Stock, buscar el producto en una lista
// larga y recién ahí operar. Para quien está cargando su emprendimiento por
// primera vez eso es una pared: acá el producto ya está elegido y lo único que
// queda es escribir el número.

const OPS: { op: StockOp; label: string; hint: string; placeholder: string }[] = [
  { op: "adjust", label: "Conté", hint: "Dejá la existencia en lo que contaste de verdad.", placeholder: "Lo que hay" },
  { op: "receive", label: "Llegó", hint: "Mercadería que entró.", placeholder: "Lo que entró" },
  { op: "loss", label: "Se perdió", hint: "Rotura, vencimiento o faltante.", placeholder: "Lo que se perdió" },
];

export function ProductStockPanel({
  productId,
  branchId,
  branchName,
  unit,
  quantity,
  minStock,
  onChanged,
}: {
  productId: string;
  branchId: string;
  branchName: string;
  unit: Unit;
  // Existencia actual en milésimas. null = el producto no lleva control.
  quantity: number | null;
  minStock: number | null;
  onChanged?: () => void;
}) {
  const [op, setOp] = useState<StockOp | null>(null);
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [displayQuantity, setDisplayQuantity] = useState(quantity);
  const [isPending, startTransition] = useTransition();

  if (displayQuantity === null) {
    return null;
  }

  const low = minStock !== null && displayQuantity <= minStock;
  const active = OPS.find((item) => item.op === op) ?? null;

  function open(next: StockOp) {
    setOp(next === op ? null : next);
    setValue("");
    setReason("");
  }

  function submit() {
    if (!op) return;

    const parsed = parseQuantityInput(value, unit);
    // Contar cero es legítimo ("se acabó"); recibir o perder cero, no.
    const amount = parsed ?? (op === "adjust" && value.trim() === "0" ? 0 : null);

    if (amount === null) {
      toast.error("Escribí una cantidad válida.");
      return;
    }

    startTransition(async () => {
      const result = await applyProductStockAction({ op, productId, branchId, quantity: amount, reason });

      if (result.ok) {
        toast.success("Stock actualizado.");
        setDisplayQuantity(result.quantity);
        setOp(null);
        setValue("");
        setReason("");
        onChanged?.();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="rounded-2xl bg-slate-50 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Package className={`size-5 ${low ? "text-amber-600" : "text-slate-400"}`} />
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">En {branchName}</p>
            <p className={`text-lg font-black ${low ? "text-amber-600" : "text-slate-950"}`}>
              {formatQuantity(displayQuantity, unit)}
              {low ? <span className="ml-2 text-xs font-bold">hay que reponer</span> : null}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {OPS.map((item) => (
            <button
              className={`rounded-xl px-3 py-2 text-xs font-black transition active:scale-95 ${
                op === item.op ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
              } disabled:cursor-wait disabled:opacity-50`}
              disabled={isPending}
              key={item.op}
              onClick={() => open(item.op)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {active ? (
        <div className="mt-3 grid gap-2 duration-300 animate-in fade-in slide-in-from-top-1">
          <p className="text-xs text-slate-500">{active.hint}</p>
          <div className="flex items-center gap-2">
            <span className="flex flex-1 items-center rounded-xl border border-slate-200 bg-white px-3">
              <input
                aria-label={active.placeholder}
                className="w-full min-w-0 bg-transparent py-2.5 text-base font-black text-slate-950 outline-none"
                inputMode="decimal"
                onChange={(event) => setValue(event.target.value)}
                placeholder={active.placeholder}
                value={value}
              />
              <span className="shrink-0 text-xs font-black text-slate-400">{unitShort(unit)}</span>
            </span>
            <button
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white transition active:scale-95 disabled:bg-slate-200 disabled:text-slate-400"
              disabled={isPending}
              onClick={submit}
              type="button"
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Guardar
            </button>
          </div>
          {op !== "receive" ? (
            <input
              aria-label="Motivo"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-950 outline-none"
              onChange={(event) => setReason(event.target.value)}
              placeholder={op === "loss" ? "Motivo (se venció, se rompió…)" : "Motivo (conteo de fin de mes…)"}
              value={reason}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
