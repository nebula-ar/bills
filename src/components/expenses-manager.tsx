"use client";

import { createExpenseAction, deleteExpenseAction, updateExpenseAction } from "@/app/expenses/actions";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Trash2, Wallet, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export type ExpenseRow = {
  id: string;
  category: string;
  categoryLabel: string;
  branchId: string | null;
  branchLabel: string;
  amount: number;
  amountLabel: string;
  note: string | null;
  spentAtValue: string;
  dateLabel: string;
};

export type ExpensesData = {
  businessName: string;
  monthKey: string;
  monthLabel: string;
  prevMonthKey: string;
  nextMonthKey: string;
  total: number;
  totalLabel: string;
  count: number;
  branches: { id: string; name: string }[];
  categories: { value: string; label: string }[];
  todayValue: string;
  expenses: ExpenseRow[];
  flash: { status: "success" | "error"; message: string } | null;
};

function ExpenseFormFields({
  categories,
  branches,
  defaultCategory,
  defaultBranchId,
  defaultAmount,
  defaultNote,
  defaultDate,
}: {
  categories: { value: string; label: string }[];
  branches: { id: string; name: string }[];
  defaultCategory: string;
  defaultBranchId: string;
  defaultAmount: string;
  defaultNote: string;
  defaultDate: string;
}) {
  const [category, setCategory] = useState(defaultCategory);

  return (
    <div className="space-y-4">
      <input name="category" type="hidden" value={category} />

      <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
        Monto
        <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-blue-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100">
          <span className="text-2xl font-black text-slate-400">$</span>
          <input
            autoFocus
            className="w-full bg-transparent px-2 py-3.5 text-2xl font-black text-slate-950 outline-none"
            defaultValue={defaultAmount}
            inputMode="numeric"
            min={1}
            name="amount"
            placeholder="0"
            step={1}
            type="number"
          />
        </div>
      </label>

      <div className="grid gap-2">
        <span className="text-xs font-black uppercase tracking-wide text-slate-500">Categoría</span>
        <div className="flex flex-wrap gap-2">
          {categories.map((option) => {
            const active = option.value === category;
            return (
              <button
                className={`rounded-full px-3.5 py-2 text-sm font-bold transition active:scale-95 ${
                  active ? "bg-blue-600 text-white shadow-sm shadow-blue-600/25" : "bg-slate-100 text-slate-600"
                }`}
                key={option.value}
                onClick={() => setCategory(option.value)}
                type="button"
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
        Sucursal
        <div className="relative">
          <select
            className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 pr-11 text-base font-bold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
            defaultValue={defaultBranchId}
            name="branchId"
          >
            <option value="">General (todo el negocio)</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
        </div>
      </label>

      <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
        Fecha
        <input
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-bold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          defaultValue={defaultDate}
          name="spentAt"
          type="date"
        />
      </label>

      <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
        Nota (opcional)
        <input
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          defaultValue={defaultNote}
          name="note"
          placeholder="Ej: shampoo y toallas"
          type="text"
        />
      </label>
    </div>
  );
}

export function ExpensesManager({ data }: { data: ExpensesData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newOpen, setNewOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const editing = data.expenses.find((expense) => expense.id === editId) ?? null;

  function goToMonth(monthKey: string) {
    startTransition(() => router.push(`/expenses?month=${monthKey}`, { scroll: false }));
  }

  return (
    <main className="mx-auto min-h-screen w-full min-w-0 max-w-[560px] overflow-x-clip bg-[#f6f7fb] px-4 pb-28 pt-6 text-slate-950">
      <header className="flex items-center justify-between gap-4 duration-500 animate-in fade-in slide-in-from-top-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-500">{data.businessName}</p>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight text-slate-950">Gastos</h1>
        </div>
        <button
          className="flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-black text-white shadow-sm shadow-blue-600/25 transition active:scale-95"
          onClick={() => setNewOpen(true)}
          type="button"
        >
          <Plus className="size-4" />
          Nuevo
        </button>
      </header>

      {/* Navegador de mes */}
      <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-slate-950/5">
        <button
          aria-label="Mes anterior"
          className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition active:scale-90"
          onClick={() => goToMonth(data.prevMonthKey)}
          type="button"
        >
          <ChevronLeft className="size-5" />
        </button>
        <span className="text-sm font-black text-slate-950">{data.monthLabel}</span>
        <button
          aria-label="Mes siguiente"
          className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition active:scale-90"
          onClick={() => goToMonth(data.nextMonthKey)}
          type="button"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      {data.flash ? (
        <div
          className={`mt-3 rounded-2xl px-4 py-3 text-sm font-semibold duration-300 animate-in fade-in ${
            data.flash.status === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {data.flash.message}
        </div>
      ) : null}

      {/* Total del mes */}
      <div className="mt-3 rounded-[1.5rem] bg-gradient-to-br from-rose-500 to-rose-600 p-5 text-white shadow-lg shadow-rose-500/25">
        <p className="flex items-center gap-1.5 text-sm font-medium text-rose-100">
          <Wallet className="size-4" />
          Total gastado este mes
        </p>
        <p className="mt-1.5 text-[2.2rem] font-black leading-none tracking-tight" style={{ fontVariantNumeric: "tabular-nums" }}>
          {data.totalLabel}
        </p>
        <p className="mt-2 text-xs font-medium text-rose-100">
          {data.count} {data.count === 1 ? "gasto" : "gastos"}
        </p>
      </div>

      <div className={`mt-4 ${isPending ? "pointer-events-none opacity-60 transition-opacity" : "transition-opacity"}`}>
        {data.expenses.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            No hay gastos en {data.monthLabel}. Tocá «Nuevo» para registrar el primero.
          </div>
        ) : (
          <ul className="space-y-2.5">
            {data.expenses.map((expense, index) => (
              <li
                className="duration-500 animate-in fade-in slide-in-from-bottom-2"
                key={expense.id}
                style={{ animationDelay: `${Math.min(index * 30, 240)}ms`, animationFillMode: "backwards" }}
              >
                <button
                  className="flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-sm ring-1 ring-slate-950/5 transition active:scale-[0.99]"
                  onClick={() => setEditId(expense.id)}
                  type="button"
                >
                  <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                    <span className="text-[0.6rem] font-black uppercase leading-none">{expense.dateLabel}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-slate-950">{expense.categoryLabel}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {expense.branchLabel}
                      {expense.note ? ` · ${expense.note}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 text-right text-sm font-black text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {expense.amountLabel}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Nuevo gasto */}
      <BottomSheet onClose={() => setNewOpen(false)} open={newOpen}>
        <form action={createExpenseAction} className="flex min-h-0 flex-1 flex-col">
          <input name="month" type="hidden" value={data.monthKey} />
          <div className="flex items-center justify-between px-5 pt-6">
            <h3 className="text-xl font-black tracking-tight text-slate-950">Nuevo gasto</h3>
            <button
              aria-label="Cerrar"
              className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:scale-90"
              onClick={() => setNewOpen(false)}
              type="button"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5">
            <ExpenseFormFields
              branches={data.branches}
              categories={data.categories}
              defaultAmount=""
              defaultBranchId=""
              defaultCategory={data.categories[2]?.value ?? data.categories[0]?.value ?? ""}
              defaultDate={data.todayValue}
              defaultNote=""
            />
          </div>
          <div className="mt-auto border-t border-slate-100 px-5 pb-1 pt-4">
            <button
              className="w-full rounded-2xl bg-blue-600 px-4 py-4 text-base font-black text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.99]"
              type="submit"
            >
              Registrar gasto
            </button>
          </div>
        </form>
      </BottomSheet>

      {/* Editar gasto */}
      <BottomSheet onClose={() => setEditId(null)} open={editing !== null}>
        {editing ? (
          <div className="flex min-h-0 flex-1 flex-col" key={editing.id}>
            <div className="flex items-center justify-between px-5 pt-6">
              <h3 className="text-xl font-black tracking-tight text-slate-950">Editar gasto</h3>
              <button
                aria-label="Cerrar"
                className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:scale-90"
                onClick={() => setEditId(null)}
                type="button"
              >
                <X className="size-5" />
              </button>
            </div>
            <form action={updateExpenseAction} className="flex min-h-0 flex-1 flex-col">
              <input name="month" type="hidden" value={data.monthKey} />
              <input name="expenseId" type="hidden" value={editing.id} />
              <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5">
                <ExpenseFormFields
                  branches={data.branches}
                  categories={data.categories}
                  defaultAmount={String(editing.amount)}
                  defaultBranchId={editing.branchId ?? ""}
                  defaultCategory={editing.category}
                  defaultDate={editing.spentAtValue}
                  defaultNote={editing.note ?? ""}
                />
              </div>
              <div className="mt-auto border-t border-slate-100 px-5 pb-1 pt-4">
                <button
                  className="w-full rounded-2xl bg-blue-600 px-4 py-4 text-base font-black text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.99]"
                  type="submit"
                >
                  Guardar cambios
                </button>
              </div>
            </form>
            <div className="px-5 pb-5">
              <form action={deleteExpenseAction}>
                <input name="month" type="hidden" value={data.monthKey} />
                <input name="expenseId" type="hidden" value={editing.id} />
                <button
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-600 transition active:scale-[0.99]"
                  type="submit"
                >
                  <Trash2 className="size-4" />
                  Borrar gasto
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </BottomSheet>
    </main>
  );
}
