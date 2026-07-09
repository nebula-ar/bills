import { getBarberSession } from "@/lib/barber-session";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-labels";
import { barberCanCloseCash } from "@/modules/cash/cash.logic";
import { getAccountBalances } from "@/modules/cash/cash.use-cases";
import { getSaleEntryOptions } from "@/modules/sales/get-sale-entry-options.use-case";
import { Landmark, Lock } from "lucide-react";
import Link from "next/link";

import { submitBarberCashClose } from "../actions";
import { BarberTerminalNav } from "../barber-terminal-nav";

function money(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-[100dvh] justify-center bg-slate-100 text-slate-950 sm:px-6 sm:py-8">
      <section className="relative flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-white sm:h-[calc(100dvh-4rem)] sm:rounded-[2.5rem] sm:shadow-[0_24px_80px_rgba(15,23,42,0.16)] sm:ring-1 sm:ring-slate-200 lg:max-w-3xl">
        {children}
      </section>
    </main>
  );
}

function Blocked({ title, message }: { title: string; message: string }) {
  return (
    <Shell>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-5 py-8 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Lock className="size-7" />
        </span>
        <h1 className="text-xl font-black tracking-tight text-slate-950">{title}</h1>
        <p className="max-w-xs text-sm text-slate-500">{message}</p>
        <Link className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white" href="/barber">
          Volver a la terminal
        </Link>
      </div>
    </Shell>
  );
}

export default async function BarberCashClosePage() {
  const session = await getBarberSession();
  if (!session) {
    return <Blocked message="Abrí tu turno con tu PIN para cerrar la caja." title="Turno cerrado" />;
  }

  const branch = await getSaleEntryOptions(session.branchId);
  const barber = branch?.users.find((user) => user.id === session.barberId) ?? null;

  if (!branch || !barberCanCloseCash(barber)) {
    return <Blocked message="Solo un encargado puede cerrar la caja. Pedile acceso al administrador." title="Sin permiso" />;
  }

  const balances = await getAccountBalances({ businessId: branch.businessId, branchId: session.branchId });
  const accounts = balances.filter(
    (account) => account.balance !== 0 || account.opening !== 0 || account.income !== 0 || account.expense !== 0,
  );
  const total = accounts.reduce((sum, account) => sum + account.balance, 0);
  const saleHref = `/barber?branch=${session.branchId}&barber=${session.barberId}`;

  return (
    <Shell>
      <div className="shrink-0 border-b border-slate-100 px-5 py-4">
        <h1 className="flex items-center gap-2 text-xl font-black tracking-tight text-slate-950">
          <Landmark aria-hidden="true" className="text-blue-600" size={20} />
          Cerrar caja
        </h1>
        <p className="mt-0.5 truncate text-sm font-bold text-slate-500">
          {barber?.name} · {branch.name}
        </p>
      </div>

      <form action={submitBarberCashClose} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-5">
          <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
            Contá cuánto hay realmente en cada cuenta. Se guarda el saldo del sistema y lo contado para ver diferencias.
          </p>

          {accounts.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
              No hay saldos para cerrar en esta sucursal.
            </p>
          ) : (
            accounts.map((account) => (
              <div className="rounded-2xl bg-slate-50 p-3" key={account.method}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-slate-700">{PAYMENT_METHOD_LABELS[account.method]}</span>
                  <span className="text-xs font-bold text-slate-400" style={{ fontVariantNumeric: "tabular-nums" }}>
                    Sistema: {money(account.balance)}
                  </span>
                </div>
                <div className="mt-2 flex items-center rounded-xl border border-slate-200 bg-white px-3 focus-within:border-blue-400">
                  <span className="text-base font-black text-slate-400">$</span>
                  <input
                    className="w-full bg-transparent px-1.5 py-2.5 text-right text-base font-black text-slate-950 outline-none"
                    defaultValue={String(account.balance)}
                    inputMode="numeric"
                    name={`counted_${account.method}`}
                    placeholder="0"
                    step={1}
                    type="number"
                  />
                </div>
              </div>
            ))
          )}

          <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
            Nota (opcional)
            <input
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
              name="note"
              placeholder="Ej: cierre del turno tarde"
              type="text"
            />
          </label>

          <div className="flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-3 text-white">
            <span className="text-sm font-medium text-slate-300">Total en caja</span>
            <span className="text-lg font-black" style={{ fontVariantNumeric: "tabular-nums" }}>
              {money(total)}
            </span>
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-3">
          <button
            className="w-full rounded-2xl bg-blue-600 px-4 py-4 text-base font-black text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.99]"
            type="submit"
          >
            Cerrar caja
          </button>
        </div>
      </form>

      <BarberTerminalNav active="cash" saleHref={saleHref} showCashClose />
    </Shell>
  );
}
