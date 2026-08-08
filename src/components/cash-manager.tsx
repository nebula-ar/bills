"use client";

import { createCashCloseAction, createTransferAction, deleteTransferAction, saveOpeningBalancesAction } from "@/app/caja/actions";
import { AnimatedMoney } from "@/components/animated-number";
import { PeriodFade } from "@/components/period-fade";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { MoneyInput } from "@/components/money-input";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { ArrowRight, ChevronDown, Lock, PiggyBank, Trash2, Wallet, X } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Account = {
  method: string;
  label: string;
  opening: number;
  income: number;
  expense: number;
  transferIn: number;
  transferOut: number;
  balance: number;
  hasActivity: boolean;
};

export type CashData = {
  businessName: string;
  branches: { id: string; name: string }[];
  selectedBranchId: string;
  totalBalance: number;
  accounts: Account[];
  paymentMethods: { value: string; label: string }[];
  transfers: { id: string; fromLabel: string; toLabel: string; amount: number; note: string | null; dateLabel: string }[];
  closes: {
    id: string;
    dateLabel: string;
    branchLabel: string;
    note: string | null;
    totalSystem: number;
    totalCounted: number;
    diff: number;
    lines: { label: string; system: number; counted: number; diff: number }[];
  }[];
  todayValue: string;
  flash: { status: "success" | "error"; message: string } | null;
};

function money(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

const tabular = { fontVariantNumeric: "tabular-nums" } as const;

export function CashManager({ data }: { data: CashData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [openingOpen, setOpeningOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  const activeAccounts = data.accounts.filter((a) => a.hasActivity);
  const branchField = data.selectedBranchId;

  function selectBranch(id: string) {
    startTransition(() => router.push(id ? `/caja?branchId=${id}` : "/caja", { scroll: false }));
  }

  return (
    <main className="mx-auto min-h-screen w-full min-w-0 max-w-[560px] overflow-x-clip bg-[var(--background)] px-4 pb-28 pt-6 text-slate-950 lg:max-w-none lg:px-8">
      <header className="flex items-center justify-between gap-4 duration-500 animate-in fade-in slide-in-from-top-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-500">{data.businessName}</p>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight text-slate-950">Caja</h1>
        </div>
      </header>

      {data.branches.length > 1 ? (
        <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <BranchChip active={data.selectedBranchId === ""} label="Todo el negocio" onClick={() => selectBranch("")} />
          {data.branches.map((branch) => (
            <BranchChip
              active={data.selectedBranchId === branch.id}
              key={branch.id}
              label={branch.name}
              onClick={() => selectBranch(branch.id)}
            />
          ))}
        </div>
      ) : null}

      {data.flash ? (
        <div
          className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold duration-300 animate-in fade-in ${
            data.flash.status === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {data.flash.message}
        </div>
      ) : null}

      <div className={isPending ? "pointer-events-none opacity-60 transition-opacity" : "transition-opacity"}>
        <PeriodFade period={`caja-${data.selectedBranchId}`}>
        {/* Saldo total */}
        <div className="mt-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-lg">
          <p className="flex items-center gap-1.5 text-sm font-medium text-slate-300">
            <Wallet className="size-4" />
            Saldo total en caja
          </p>
          <p className="mt-1.5 text-[2.4rem] font-black leading-none tracking-tight" style={tabular}>
            <AnimatedMoney value={data.totalBalance} />
          </p>
          <p className="mt-2 text-xs font-medium text-slate-400">Saldo inicial + ventas − gastos + transferencias</p>
        </div>

        {/* Acciones */}
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          <ActionButton icon={PiggyBank} label="Saldo inicial" onClick={() => setOpeningOpen(true)} />
          <ActionButton icon={ArrowRight} label="Transferencia" onClick={() => setTransferOpen(true)} />
          <ActionButton icon={Lock} label="Cerrar caja" onClick={() => setCloseOpen(true)} />
        </div>

        <div className="lg:columns-2 lg:gap-4">
          {/* Saldo por cuenta */}
          <Panel title="Saldo por cuenta">
            {activeAccounts.length === 0 ? (
              <Empty>Todavía no hay movimientos. Cargá el saldo inicial o registrá ventas y gastos.</Empty>
            ) : (
              <div className="space-y-2.5">
                {activeAccounts.map((account) => (
                  <div className="rounded-2xl bg-slate-50 p-3" key={account.method}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-black text-slate-800">{account.label}</span>
                      <span className={`shrink-0 text-sm font-black ${account.balance >= 0 ? "text-slate-950" : "text-rose-600"}`} style={tabular}>
                        {money(account.balance)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-semibold text-slate-500" style={tabular}>
                      {account.opening !== 0 ? <span>Inicial {money(account.opening)}</span> : null}
                      {account.income !== 0 ? <span className="text-emerald-600">+{money(account.income)} ventas</span> : null}
                      {account.expense !== 0 ? <span className="text-rose-500">−{money(account.expense)} gastos</span> : null}
                      {account.transferIn !== 0 ? <span className="text-emerald-600">+{money(account.transferIn)} transf.</span> : null}
                      {account.transferOut !== 0 ? <span className="text-rose-500">−{money(account.transferOut)} transf.</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Transferencias */}
          <Panel title="Transferencias">
            {data.transfers.length === 0 ? (
              <Empty>Sin transferencias registradas.</Empty>
            ) : (
              <ul className="space-y-2">
                {data.transfers.map((transfer) => (
                  <li className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3" key={transfer.id}>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-black text-slate-800">
                        {transfer.fromLabel}
                        <ArrowRight className="size-3.5 shrink-0 text-slate-400" />
                        {transfer.toLabel}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {transfer.dateLabel}
                        {transfer.note ? ` · ${transfer.note}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-black text-slate-950" style={tabular}>
                      {money(transfer.amount)}
                    </span>
                    <form action={deleteTransferAction}>
                      <input name="branchId" type="hidden" value={branchField} />
                      <input name="transferId" type="hidden" value={transfer.id} />
                      <ConfirmSubmit
                        className="flex size-11 shrink-0 items-center justify-center rounded-full text-slate-400 transition active:scale-90 hover:text-rose-600"
                        confirmLabel="Sí"
                      >
                        <Trash2 className="size-4" />
                      </ConfirmSubmit>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Historial de cierres */}
          <Panel title="Cierres de caja">
            {data.closes.length === 0 ? (
              <Empty>Todavía no cerraste caja.</Empty>
            ) : (
              <ul className="space-y-2.5">
                {data.closes.map((close) => (
                  <li className="rounded-2xl bg-slate-50 p-3" key={close.id}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-800">{close.dateLabel}</p>
                        <p className="truncate text-xs text-slate-500">{close.branchLabel}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-black text-slate-950" style={tabular}>
                          {money(close.totalCounted)}
                        </p>
                        <p
                          className={`text-xs font-bold ${close.diff === 0 ? "text-slate-400" : close.diff > 0 ? "text-emerald-600" : "text-rose-600"}`}
                          style={tabular}
                        >
                          {close.diff === 0 ? "Sin diferencia" : `${close.diff > 0 ? "+" : ""}${money(close.diff)}`}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
        </PeriodFade>
      </div>

      {/* Sheet: saldo inicial */}
      <BottomSheet onClose={() => setOpeningOpen(false)} open={openingOpen}>
        <form action={saveOpeningBalancesAction} className="flex min-h-0 flex-1 flex-col">
          <input name="branchId" type="hidden" value={branchField} />
          <SheetHeader onClose={() => setOpeningOpen(false)} title="Saldo inicial por cuenta" />
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pt-5">
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
              El saldo con el que arranca cada cuenta. Lo que pongas se suma a ventas, gastos y transferencias para el saldo actual.
            </p>
            {data.accounts.map((account) => (
              <label className="flex items-center justify-between gap-3" key={account.method}>
                <span className="text-sm font-black text-slate-700">{account.label}</span>
                <div className="flex w-40 items-center rounded-2xl border border-slate-200 bg-slate-50 px-3 focus-within:border-primary/40 focus-within:bg-white">
                  <span className="text-lg font-black text-slate-400">$</span>
                  <MoneyInput
                    className="w-full bg-transparent px-1.5 py-2.5 text-right text-lg font-black text-slate-950 outline-none"
                    defaultValue={account.opening ? String(account.opening) : ""}
                    name={`opening_${account.method}`}
                    placeholder="0"
                  />
                </div>
              </label>
            ))}
          </div>
          <SheetFooter label="Guardar saldos" />
        </form>
      </BottomSheet>

      {/* Sheet: nueva transferencia */}
      <BottomSheet onClose={() => setTransferOpen(false)} open={transferOpen}>
        <form action={createTransferAction} className="flex min-h-0 flex-1 flex-col">
          <input name="branchId" type="hidden" value={branchField} />
          <SheetHeader onClose={() => setTransferOpen(false)} title="Nueva transferencia" />
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pt-5">
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
              Movés plata de una cuenta a otra (ej: retirás de Mercado Pago y lo pasás a Efectivo).
            </p>
            <MethodSelect defaultValue={data.paymentMethods[1]?.value} label="Sale de" name="fromMethod" options={data.paymentMethods} />
            <MethodSelect defaultValue={data.paymentMethods[0]?.value} label="Entra a" name="toMethod" options={data.paymentMethods} />
            <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
              Monto
              <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-primary/40 focus-within:bg-white focus-within:ring-4 focus-within:ring-primary/15">
                <span className="text-2xl font-black text-slate-400">$</span>
                <MoneyInput
                  className="w-full bg-transparent px-2 py-3.5 text-2xl font-black text-slate-950 outline-none"
                  name="amount"
                  placeholder="0"
                />
              </div>
            </label>
            <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
              Fecha
              <input
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-bold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15"
                defaultValue={data.todayValue}
                name="movedAt"
                type="date"
              />
            </label>
            <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
              Nota (opcional)
              <input
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15"
                name="note"
                placeholder="Ej: retiro para pagar proveedor"
                type="text"
              />
            </label>
          </div>
          <SheetFooter label="Registrar transferencia" />
        </form>
      </BottomSheet>

      {/* Sheet: cerrar caja */}
      <BottomSheet onClose={() => setCloseOpen(false)} open={closeOpen}>
        <form action={createCashCloseAction} className="flex min-h-0 flex-1 flex-col">
          <input name="branchId" type="hidden" value={branchField} />
          <SheetHeader onClose={() => setCloseOpen(false)} title="Cerrar el día" />
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pt-5">
            {/* Los campos van vacíos a propósito: venían con el saldo del
                sistema y así el arqueo era un trámite que siempre daba "sin
                diferencia". Contar es el punto de cerrar la caja. */}
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
              Contá la plata que hay de verdad y escribila acá. Comparamos con lo que dice el sistema para mostrarte la
              diferencia — si no contás, no sirve de nada.
            </p>
            {activeAccounts.length === 0 ? (
              <Empty>No hay saldos para cerrar.</Empty>
            ) : (
              activeAccounts.map((account) => (
                <div className="rounded-2xl bg-slate-50 p-3" key={account.method}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-slate-700">{account.label}</span>
                    <span className="text-xs font-bold text-slate-400" style={tabular}>
                      Sistema: {money(account.balance)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center rounded-xl border border-slate-200 bg-white px-3 focus-within:border-primary/40">
                    <span className="text-base font-black text-slate-400">$</span>
                    <MoneyInput
                      className="w-full bg-transparent px-1.5 py-2.5 text-right text-base font-black text-slate-950 outline-none"
                      name={`counted_${account.method}`}
                      placeholder="¿Cuánto contaste?"
                    />
                  </div>
                </div>
              ))
            )}
            <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
              Nota (opcional)
              <input
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15"
                name="note"
                placeholder="Ej: cierre del turno tarde"
                type="text"
              />
            </label>
          </div>
          <SheetFooter label="Cerrar caja" />
        </form>
      </BottomSheet>
    </main>
  );
}

function BranchChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition active:scale-95 ${
        active ? "bg-primary text-white shadow-sm shadow-primary/25" : "bg-white text-slate-600 ring-1 ring-slate-950/5"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function ActionButton({ icon: Icon, label, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void }) {
  return (
    <button
      className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-white p-3 text-center shadow-sm ring-1 ring-slate-950/5 transition active:scale-95"
      onClick={onClick}
      type="button"
    >
      <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <span className="text-xs font-black text-slate-700">{label}</span>
    </button>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 break-inside-avoid rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-950/5">
      <h2 className="text-base font-black text-slate-950">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {children}
    </p>
  );
}

function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-5 pt-6">
      <h3 className="text-xl font-black tracking-tight text-slate-950">{title}</h3>
      <button
        aria-label="Cerrar"
        className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:scale-90"
        onClick={onClose}
        type="button"
      >
        <X className="size-5" />
      </button>
    </div>
  );
}

function SheetFooter({ label }: { label: string }) {
  return (
    <div className="mt-auto border-t border-slate-100 px-5 pb-1 pt-4">
      <button
        className="w-full rounded-2xl bg-primary px-4 py-4 text-base font-black text-white shadow-sm shadow-primary/25 transition hover:bg-primary-strong active:scale-[0.99]"
        type="submit"
      >
        {label}
      </button>
    </div>
  );
}

function MethodSelect({
  label,
  name,
  options,
  defaultValue,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
}) {
  return (
    <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
      {label}
      <div className="relative">
        <select
          className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 pr-11 text-base font-bold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15"
          defaultValue={defaultValue}
          name={name}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
      </div>
    </label>
  );
}
