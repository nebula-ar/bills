"use client";

import { cancelSaleAction } from "@/app/sales/actions";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Ban, ReceiptText, X } from "lucide-react";
import { useState } from "react";

export type SalesListSale = {
  id: string;
  timeLabel: string;
  dateLabel: string;
  barberName: string;
  branchName: string;
  total: number;
  status: "COMPLETED" | "CANCELLED";
  itemSummary: string;
  paymentSummary: string;
  items: { id: string; description: string; quantity: number; total: number }[];
  payments: { id: string; label: string; amount: number }[];
};

function money(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

export function SalesList({ sales }: { sales: SalesListSale[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const selected = sales.find((sale) => sale.id === selectedId) ?? null;

  if (sales.length === 0) {
    return (
      <div className="mt-12 flex flex-col items-center justify-center rounded-[2rem] border border-dashed border-slate-200 bg-white/50 p-10 text-center">
        <div className="mb-4 flex size-20 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-950/5">
          <ReceiptText className="size-8 text-slate-300" />
        </div>
        <p className="text-sm font-bold text-slate-600">Todavía no hay ventas</p>
        <p className="mt-1 text-xs text-slate-400">Tocá el botón «+» abajo para cargar la primera.</p>
      </div>
    );
  }

  return (
    <>
      <ul className="mt-4 space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
        {sales.map((sale, index) => {
          const cancelled = sale.status === "CANCELLED";
          return (
            <li
              className="duration-500 animate-in fade-in slide-in-from-bottom-2"
              key={sale.id}
              style={{ animationDelay: `${Math.min(index * 40, 320)}ms`, animationFillMode: "backwards" }}
            >
              <button
                className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ring-slate-950/5 transition active:scale-[0.99]"
                onClick={() => {
                  setSelectedId(sale.id);
                  setConfirming(false);
                }}
                type="button"
              >
                <span
                  className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${
                    cancelled ? "bg-rose-50 text-rose-500" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {cancelled ? <Ban className="size-5" /> : <ReceiptText className="size-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-bold ${cancelled ? "text-slate-400 line-through" : "text-slate-950"}`}>
                    {sale.barberName}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {sale.paymentSummary}
                    {sale.itemSummary ? ` · ${sale.itemSummary}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={`text-sm font-black ${cancelled ? "text-slate-400 line-through" : "text-slate-950"}`}
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {money(sale.total)}
                  </p>
                  <p className={`text-xs ${cancelled ? "font-bold text-rose-500" : "text-slate-400"}`}>
                    {cancelled ? "Cancelada" : `${sale.timeLabel} hs`}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <BottomSheet onClose={() => setSelectedId(null)} open={selected !== null}>
        {selected ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-3 px-5 pt-6">
              <div className="min-w-0">
                <h3 className="text-xl font-black tracking-tight text-slate-950">{selected.barberName}</h3>
                <p className="mt-0.5 truncate text-sm text-slate-500">
                  {selected.dateLabel} · {selected.branchName}
                </p>
              </div>
              <button
                aria-label="Cerrar"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:scale-90"
                onClick={() => setSelectedId(null)}
                type="button"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5">
              {selected.status === "CANCELLED" ? (
                <div className="mb-4 flex items-center gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                  <Ban className="size-4" />
                  Venta cancelada
                </div>
              ) : null}

              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Ítems</p>
              <div className="mt-2 space-y-2">
                {selected.items.map((item) => (
                  <div className="flex items-center justify-between gap-3 text-sm" key={item.id}>
                    <span className="min-w-0 truncate text-slate-700">
                      {item.description} <span className="text-slate-400">×{item.quantity}</span>
                    </span>
                    <span className="shrink-0 font-bold text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {money(item.total)}
                    </span>
                  </div>
                ))}
              </div>

              <p className="mt-5 text-xs font-black uppercase tracking-wide text-slate-500">Pagos</p>
              <div className="mt-2 space-y-2">
                {selected.payments.map((payment) => (
                  <div className="flex items-center justify-between gap-3 text-sm" key={payment.id}>
                    <span className="text-slate-700">{payment.label}</span>
                    <span className="font-bold text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {money(payment.amount)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="text-sm font-bold text-slate-500">Total</span>
                <span className="text-xl font-black text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {money(selected.total)}
                </span>
              </div>
            </div>

            {selected.status === "COMPLETED" ? (
              <div className="mt-auto border-t border-slate-100 px-5 pb-1 pt-4">
                {confirming ? (
                  <form action={cancelSaleAction} className="space-y-3">
                    <input name="saleId" type="hidden" value={selected.id} />
                    <textarea
                      className="min-h-20 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      maxLength={500}
                      name="reason"
                      placeholder="Motivo de la cancelación (opcional)"
                    />
                    <div className="flex gap-3">
                      <button
                        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-600 transition active:scale-95"
                        onClick={() => setConfirming(false)}
                        type="button"
                      >
                        Volver
                      </button>
                      <button
                        className="flex-1 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-black text-white transition hover:bg-rose-700 active:scale-[0.99]"
                        type="submit"
                      >
                        Confirmar cancelación
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm font-black text-rose-600 transition active:scale-[0.99]"
                    onClick={() => setConfirming(true)}
                    type="button"
                  >
                    <Ban className="size-4" />
                    Cancelar venta
                  </button>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </BottomSheet>
    </>
  );
}
