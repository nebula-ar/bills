"use client";

import { cancelSaleAction, emitInvoiceAction } from "@/app/sales/actions";
import { AfipQrCode } from "@/components/afip-qr-code";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import type { AfipStatus, InvoiceType } from "@/generated/prisma/client";
import { AFIP_STATUS_LABELS } from "@/lib/invoice-labels";
import { Ban, CheckCircle2, Loader2, QrCode, ReceiptText, TriangleAlert, X, RotateCcw } from "@/components/icons";
import { useState, useTransition } from "react";
import { SaleReturnSheet } from "@/components/sale-return-sheet";
import { formatQuantity } from "@/lib/quantity";
import { receiptMessage } from "@/modules/messaging/whatsapp.logic";
import { WhatsappButton } from "@/components/whatsapp-button";
import { useRouter } from "next/navigation";

export type SalesListSale = {
  id: string;
  timeLabel: string;
  dateLabel: string;
  staffName: string;
  branchName: string;
  total: number;
  status: "COMPLETED" | "CANCELLED";
  itemSummary: string;
  paymentSummary: string;
  items: { id: string; description: string; quantity: number; total: number }[];
  payments: { id: string; label: string; amount: number }[];
  customerName: string | null;
  customerPhone: string | null;
  customerTaxId: string | null;
  invoiceType: InvoiceType | null;
  afipStatus: AfipStatus;
  afipError: string | null;
  cae: string | null;
  caeVencimiento: string | null;
  qrUrl: string | null;
};

const AFIP_BADGE_STYLES: Record<AfipStatus, string> = {
  NOT_CONFIGURED: "bg-slate-100 text-slate-500",
  PENDING: "bg-amber-50 text-amber-700",
  ISSUED: "bg-emerald-50 text-emerald-700",
  FAILED: "bg-rose-50 text-rose-700",
};

function money(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

type SalesListProps = {
  sales: SalesListSale[];
  // Nombre del negocio: encabeza el comprobante que se manda por WhatsApp.
  businessName?: string;
  initialCursor?: string | null;
  loadMore?: (cursor: string) => Promise<{ sales: SalesListSale[]; nextCursor: string | null }>;
};

export function SalesList({ sales, businessName = "", initialCursor = null, loadMore }: SalesListProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [returning, setReturning] = useState<string | null>(null);
  const [items, setItems] = useState(sales);
  const [syncedSales, setSyncedSales] = useState(sales);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, startLoading] = useTransition();
  const [invoicing, startInvoicing] = useTransition();
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const selected = items.find((sale) => sale.id === selectedId) ?? null;

  // Sincroniza con la data fresca del server tras un router.refresh() (p.ej.
  // después de emitir una factura), sin perder páginas ya cargadas con "más".
  // Ajuste de estado durante el render (no en un efecto): evita el
  // cascading-render que dispara actualizar el estado desde un useEffect.
  if (sales !== syncedSales) {
    setSyncedSales(sales);
    setItems(sales);
  }

  function handleEmitInvoice(saleId: string) {
    setInvoiceError(null);
    startInvoicing(async () => {
      const result = await emitInvoiceAction(saleId);
      if (result.ok) {
        router.refresh();
      } else {
        setInvoiceError(result.error);
      }
    });
  }

  function handleLoadMore() {
    if (!loadMore || !cursor) return;
    startLoading(async () => {
      const page = await loadMore(cursor);
      // Deduplicamos por si una venta nueva corrió el cursor entre páginas.
      setItems((prev) => {
        const seen = new Set(prev.map((sale) => sale.id));
        return [...prev, ...page.sales.filter((sale) => !seen.has(sale.id))];
      });
      setCursor(page.nextCursor);
    });
  }

  if (items.length === 0) {
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
        {items.map((sale, index) => {
          const cancelled = sale.status === "CANCELLED";
          return (
            <li
              className="duration-500 animate-in fade-in slide-in-from-bottom-2"
              key={sale.id}
              style={{ animationDelay: `${Math.min(index * 40, 320)}ms`, animationFillMode: "backwards" }}
            >
              <button
                className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ring-slate-950/5 transition active:scale-[0.99]"
                data-testid="sale-row"
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
                    {sale.staffName}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {sale.paymentSummary}
                    {sale.itemSummary ? ` · ${sale.itemSummary}` : ""}
                  </p>
                  {!cancelled ? (
                    <span className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${AFIP_BADGE_STYLES[sale.afipStatus]}`}>
                      {sale.invoiceType ? `Factura ${sale.invoiceType} · ` : ""}
                      {AFIP_STATUS_LABELS[sale.afipStatus]}
                    </span>
                  ) : null}
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

      {cursor && loadMore ? (
        <button
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 shadow-sm transition active:scale-[0.99] disabled:opacity-60"
          data-testid="load-more"
          disabled={loading}
          onClick={handleLoadMore}
          type="button"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : null}
          {loading ? "Cargando…" : "Cargar más"}
        </button>
      ) : null}

      <BottomSheet onClose={() => setSelectedId(null)} open={selected !== null}>
        {selected ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-3 px-5 pt-6">
              <div className="min-w-0">
                <h3 className="text-xl font-black tracking-tight text-slate-950">{selected.staffName}</h3>
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
                      {item.description} <span className="text-slate-400">×{formatQuantity(item.quantity)}</span>
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

              {/* El comprobante por WhatsApp es lo que la mayoría pide en vez de
                  un ticket impreso: queda en el chat y no se pierde. */}
              {selected.status === "COMPLETED" ? (
                <div className="mt-3 flex justify-end">
                  <WhatsappButton
                    label="Mandar comprobante"
                    message={receiptMessage({
                      businessName,
                      dateLabel: selected.dateLabel,
                      items: selected.items.map((item) => ({
                        description: item.description,
                        quantity: formatQuantity(item.quantity),
                        total: item.total,
                      })),
                      total: selected.total,
                    })}
                    phone={selected.customerPhone}
                    tone="ghost"
                  />
                </div>
              ) : null}

              {selected.status === "COMPLETED" ? (
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Facturación</p>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.7rem] font-bold ${AFIP_BADGE_STYLES[selected.afipStatus]}`}>
                      {selected.afipStatus === "ISSUED" ? <CheckCircle2 className="size-3" /> : null}
                      {selected.afipStatus === "FAILED" ? <TriangleAlert className="size-3" /> : null}
                      {selected.invoiceType ? `Factura ${selected.invoiceType} · ` : ""}
                      {AFIP_STATUS_LABELS[selected.afipStatus]}
                    </span>
                  </div>

                  {selected.afipStatus === "ISSUED" && selected.cae ? (
                    <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4">
                      {selected.qrUrl ? <AfipQrCode size={88} url={selected.qrUrl} /> : null}
                      <div className="min-w-0 text-sm">
                        <p className="font-bold text-slate-950">CAE {selected.cae}</p>
                        {selected.caeVencimiento ? (
                          <p className="text-xs text-slate-500">Vence {new Date(selected.caeVencimiento).toLocaleDateString("es-AR")}</p>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* El afipStatus guardado es una foto del momento en que se creó la
                          venta o del último intento — no una condición viva de si el
                          negocio está configurado ahora. El botón siempre se muestra;
                          quien valida en vivo contra la base es el intento de emisión
                          (attemptInvoiceEmission), que ya revisa el estado fiscal actual. */}
                      {selected.afipStatus === "FAILED" && selected.afipError ? (
                        <p className="mb-2 rounded-2xl bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">{selected.afipError}</p>
                      ) : null}
                      {selected.afipStatus === "NOT_CONFIGURED" ? (
                        <p className="mb-2 rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
                          Esta venta se creó antes de completar los datos fiscales. Probá emitir igual: si el negocio ya está configurado, va a facturar.
                        </p>
                      ) : null}
                      <button
                        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3.5 text-sm font-black text-primary transition active:scale-[0.99] disabled:opacity-60"
                        disabled={invoicing}
                        onClick={() => handleEmitInvoice(selected.id)}
                        type="button"
                      >
                        {invoicing ? <Loader2 className="size-4 animate-spin" /> : <QrCode className="size-4" />}
                        {invoicing ? "Emitiendo…" : selected.afipStatus === "FAILED" ? "Reintentar factura" : "Emitir factura"}
                      </button>
                      {invoiceError && selectedId === selected.id ? (
                        <p className="mt-2 text-xs font-semibold text-rose-600" role="alert">
                          {invoiceError}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}
            </div>

            {selected.status === "COMPLETED" ? (
              <div className="mt-auto border-t border-slate-100 px-5 pb-1 pt-4">
                {confirming ? (
                  <form action={cancelSaleAction} className="space-y-3">
                    <input name="saleId" type="hidden" value={selected.id} />
                    <textarea
                      className="min-h-20 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15"
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
                  <div className="grid gap-2">
                    <button
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3.5 text-sm font-black text-white transition active:scale-[0.99]"
                      onClick={() => setReturning(selected.id)}
                      type="button"
                    >
                      <RotateCcw className="size-4" />
                      Devolver ítems
                    </button>
                    <button
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm font-black text-rose-600 transition active:scale-[0.99]"
                      onClick={() => setConfirming(true)}
                      type="button"
                    >
                      <Ban className="size-4" />
                      Cancelar venta entera
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </BottomSheet>

      <SaleReturnSheet
        onClose={() => setReturning(null)}
        onDone={() => {
          setReturning(null);
          setSelectedId(null);
          router.refresh();
        }}
        saleId={returning}
      />
    </>
  );
}
