import { PaymentMethod, SaleStatus } from "@/generated/prisma/client";
import { getBarberSession } from "@/lib/barber-session";
import { getBarberDaySales } from "@/modules/sales/get-barber-day-sales.use-case";
import { getSaleEntryOptions } from "@/modules/sales/get-sale-entry-options.use-case";
import { Scissors } from "lucide-react";
import Link from "next/link";

import { BarberTerminalNav } from "../barber-terminal-nav";

const paymentMethodLabels: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: "Efectivo",
  [PaymentMethod.DEBIT_CARD]: "Débito",
  [PaymentMethod.CREDIT_CARD]: "Crédito",
  [PaymentMethod.TRANSFER]: "Transferencia",
  [PaymentMethod.QR]: "QR",
  [PaymentMethod.OTHER]: "Otro",
};

const timeFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  hour: "2-digit",
  minute: "2-digit",
});

function money(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-[100dvh] justify-center bg-slate-100 text-slate-950 sm:px-6 sm:py-8">
      <section className="flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-white sm:h-[calc(100dvh-4rem)] sm:rounded-[2.5rem] sm:shadow-[0_24px_80px_rgba(15,23,42,0.16)] sm:ring-1 sm:ring-slate-200">
        {children}
      </section>
    </main>
  );
}

export default async function MisVentasPage() {
  const session = await getBarberSession();

  if (!session) {
    return (
      <Shell>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-5 py-8 text-center">
          <h1 className="text-xl font-black tracking-tight text-slate-950">Mis ventas</h1>
          <p className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
            Abrí tu turno con tu PIN para ver tus ventas del día.
          </p>
          <Link className="mx-auto rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white" href="/barber">
            Ir a mi terminal
          </Link>
        </div>
      </Shell>
    );
  }

  const branch = await getSaleEntryOptions(session.branchId);
  const barberName = branch?.users.find((barber) => barber.id === session.barberId)?.name ?? "Vos";
  const saleHref = `/barber?branch=${session.branchId}&barber=${session.barberId}`;

  const sales = await getBarberDaySales({ branchId: session.branchId, barberId: session.barberId, now: new Date() });
  const completed = sales.filter((sale) => sale.status === SaleStatus.COMPLETED);
  const dayTotal = completed.reduce((sum, sale) => sum + sale.total, 0);

  return (
    <Shell>
      <div className="shrink-0 border-b border-slate-100 px-5 py-4">
        <h1 className="text-xl font-black tracking-tight text-slate-950">Mis ventas de hoy</h1>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm font-bold text-slate-500">
          <Scissors aria-hidden="true" className="text-blue-600" size={14} />
          {barberName}
          {branch ? ` · ${branch.name}` : ""}
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-5 pt-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-blue-50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-blue-700">Ventas</p>
            <p className="mt-1 text-2xl font-black text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
              {completed.length}
            </p>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Total</p>
            <p className="mt-1 text-2xl font-black text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
              {money(dayTotal)}
            </p>
          </div>
        </div>

        {sales.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Todavía no cargaste ventas hoy.
          </div>
        ) : (
          <ul className="space-y-2.5">
            {sales.map((sale) => {
              const cancelled = sale.status === SaleStatus.CANCELLED;
              const itemsLabel = sale.items.map((item) => `${item.description}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`).join(" · ");
              const methods = Array.from(new Set(sale.payments.map((payment) => paymentMethodLabels[payment.method]))).join(" + ");

              return (
                <li
                  className={`rounded-2xl border p-3.5 shadow-sm ${cancelled ? "border-slate-200 bg-slate-50" : "border-slate-200 bg-white"}`}
                  key={sale.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`truncate text-sm font-black ${cancelled ? "text-slate-400 line-through" : "text-slate-950"}`}>
                        {itemsLabel || "Venta"}
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-500">
                        {timeFormatter.format(sale.soldAt)} · {methods || "—"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-sm font-black ${cancelled ? "text-slate-400" : "text-slate-950"}`} style={{ fontVariantNumeric: "tabular-nums" }}>
                        {money(sale.total)}
                      </p>
                      {cancelled ? (
                        <span className="mt-1 inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-[0.7rem] font-bold text-rose-600">
                          Cancelada
                        </span>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <BarberTerminalNav active="sales" saleHref={saleHref} />
    </Shell>
  );
}
