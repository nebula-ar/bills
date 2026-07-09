"use client";

import { createBarber, updateBarber } from "@/app/barbers/actions";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Check, ChevronDown, KeyRound, MapPin, Plus, Scissors, X } from "lucide-react";
import { useState } from "react";

export type BarberRow = {
  id: string;
  name: string;
  branchId: string | null;
  branchLabel: string;
  active: boolean;
  canCloseCash: boolean;
  hasPin: boolean;
};

export type BarberBranch = {
  id: string;
  name: string;
};

export type BarbersData = {
  businessName: string;
  barbers: BarberRow[];
  branches: BarberBranch[];
  flash: { status: "success" | "error"; message: string } | null;
};

function BranchField({
  branches,
  defaultValue,
  includeEmpty,
}: {
  branches: BarberBranch[];
  defaultValue?: string;
  includeEmpty?: boolean;
}) {
  return (
    <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
      Sucursal
      <div className="relative">
        <select
          className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 pr-11 text-base font-bold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          defaultValue={defaultValue}
          name="branchId"
          required
        >
          {includeEmpty ? <option value="">Elegí una sucursal</option> : null}
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
      </div>
    </label>
  );
}

function PinField({ required, label }: { required?: boolean; label: string }) {
  return (
    <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
      {label}
      <input
        autoComplete="off"
        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-bold tracking-[0.3em] text-slate-950 outline-none transition placeholder:tracking-normal placeholder:font-semibold focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
        inputMode="numeric"
        maxLength={8}
        minLength={4}
        name="pin"
        pattern="[0-9]*"
        placeholder="4 a 8 dígitos"
        required={required}
        type="password"
      />
    </label>
  );
}

function ActiveToggle({ defaultOn }: { defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn);

  return (
    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3.5">
      <div className="min-w-0">
        <span className="text-sm font-black text-slate-950">Barbero activo</span>
        <p className="mt-0.5 text-xs text-slate-500">Si lo desactivás, no aparece para cargar ventas.</p>
      </div>
      {on ? <input name="active" type="hidden" value="on" /> : null}
      <button
        aria-checked={on}
        aria-label="Barbero activo"
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${on ? "bg-emerald-500" : "bg-slate-300"}`}
        onClick={() => setOn((value) => !value)}
        role="switch"
        type="button"
      >
        <span
          className="absolute left-1 top-1 size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out"
          style={{ transform: on ? "translateX(1.25rem)" : "translateX(0)" }}
        />
      </button>
    </div>
  );
}

function CashCloseToggle({ defaultOn }: { defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn);

  return (
    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3.5">
      <div className="min-w-0">
        <span className="text-sm font-black text-slate-950">Puede cerrar caja</span>
        <p className="mt-0.5 text-xs text-slate-500">Encargado: cierra la caja de su sucursal desde la terminal, con su PIN.</p>
      </div>
      {on ? <input name="canCloseCash" type="hidden" value="on" /> : null}
      <button
        aria-checked={on}
        aria-label="Puede cerrar caja"
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${on ? "bg-blue-600" : "bg-slate-300"}`}
        onClick={() => setOn((value) => !value)}
        role="switch"
        type="button"
      >
        <span
          className="absolute left-1 top-1 size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out"
          style={{ transform: on ? "translateX(1.25rem)" : "translateX(0)" }}
        />
      </button>
    </div>
  );
}

export function BarbersManager({ data }: { data: BarbersData }) {
  const [newOpen, setNewOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const editing = data.barbers.find((barber) => barber.id === editId) ?? null;
  const noBranches = data.branches.length === 0;

  return (
    <main className="mx-auto min-h-screen w-full min-w-0 max-w-[560px] overflow-x-clip bg-[#f6f7fb] px-4 pb-28 pt-6 text-slate-950 lg:max-w-[1080px] lg:px-8">
      <header className="flex items-center justify-between gap-4 duration-500 animate-in fade-in slide-in-from-top-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-500">{data.businessName}</p>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight text-slate-950">Barberos</h1>
        </div>
      </header>

      {data.flash ? (
        <div
          className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold duration-300 animate-in fade-in ${
            data.flash.status === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {data.flash.message}
        </div>
      ) : null}

      <div className="mt-4">
        {data.barbers.length === 0 ? (
          <div className="mt-8 flex flex-col items-center justify-center rounded-[2rem] border border-dashed border-slate-200 bg-white/50 p-10 text-center">
            <div className="mb-4 flex size-20 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-950/5">
              <Scissors className="size-8 text-slate-300" />
            </div>
            <p className="text-sm font-bold text-slate-600">Todavía no hay barberos</p>
            <p className="mt-1 text-xs text-slate-400">Tocá el botón «+» abajo para cargar el primero.</p>
          </div>
        ) : (
          <ul className="space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
            {data.barbers.map((barber, index) => (
              <li
                className="duration-500 animate-in fade-in slide-in-from-bottom-2"
                key={barber.id}
                style={{ animationDelay: `${Math.min(index * 40, 320)}ms`, animationFillMode: "backwards" }}
              >
                <button
                  className="flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-sm ring-1 ring-slate-950/5 transition active:scale-[0.99]"
                  onClick={() => setEditId(barber.id)}
                  type="button"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <Scissors className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-slate-950">{barber.name}</p>
                    <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
                      <MapPin className="size-3 shrink-0" />
                      {barber.branchLabel}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[0.7rem] font-bold ${
                        barber.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {barber.active ? "Activo" : "Inactivo"}
                    </span>
                    {barber.canCloseCash ? (
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[0.7rem] font-bold text-blue-700">Encargado</span>
                    ) : null}
                    {!barber.hasPin ? (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[0.7rem] font-bold text-amber-700">Sin PIN</span>
                    ) : null}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Nuevo barbero */}
      <BottomSheet onClose={() => setNewOpen(false)} open={newOpen}>
        <form action={createBarber} className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between px-5 pt-6">
            <h3 className="text-xl font-black tracking-tight text-slate-950">Nuevo barbero</h3>
            <button
              aria-label="Cerrar"
              className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:scale-90"
              onClick={() => setNewOpen(false)}
              type="button"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pt-5">
            {noBranches ? (
              <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
                Primero creá una sucursal activa para poder cargar barberos.
              </p>
            ) : (
              <>
                <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                  Nombre
                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    name="name"
                    placeholder="Ej: Juan Pérez"
                    required
                    type="text"
                  />
                </label>
                <BranchField branches={data.branches} defaultValue={data.branches[0]?.id} />
                <PinField label="PIN" required />
                <p className="flex items-start gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
                  <KeyRound className="mt-0.5 size-4 shrink-0" />
                  El PIN le sirve al barbero para identificarse al cargar ventas. Se guarda protegido.
                </p>
                <CashCloseToggle defaultOn={false} />
              </>
            )}
          </div>
          {!noBranches ? (
            <div className="mt-auto border-t border-slate-100 px-5 pb-1 pt-4">
              <button
                className="w-full rounded-2xl bg-blue-600 px-4 py-4 text-base font-black text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.99]"
                type="submit"
              >
                Crear barbero
              </button>
            </div>
          ) : null}
        </form>
      </BottomSheet>

      {/* Editar barbero */}
      <BottomSheet onClose={() => setEditId(null)} open={editing !== null}>
        {editing ? (
          <form action={updateBarber} className="flex min-h-0 flex-1 flex-col" key={editing.id}>
            <input name="barberId" type="hidden" value={editing.id} />
            <div className="flex items-start justify-between gap-3 px-5 pt-6">
              <h3 className="text-xl font-black tracking-tight text-slate-950">Editar barbero</h3>
              <button
                aria-label="Cerrar"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:scale-90"
                onClick={() => setEditId(null)}
                type="button"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pt-5">
              <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                Nombre
                <input
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-bold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  defaultValue={editing.name}
                  name="name"
                  required
                  type="text"
                />
              </label>
              <BranchField branches={data.branches} defaultValue={editing.branchId ?? ""} includeEmpty={!editing.branchId} />
              <PinField label="Nuevo PIN (opcional)" />
              <p className="text-xs text-slate-500">
                {editing.hasPin ? "Dejá el PIN vacío para mantener el actual." : "Este barbero todavía no tiene PIN — cargá uno."}
              </p>
              <ActiveToggle defaultOn={editing.active} />
              <CashCloseToggle defaultOn={editing.canCloseCash} />
            </div>
            <div className="mt-auto border-t border-slate-100 px-5 pb-1 pt-4">
              <button
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 text-base font-black text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.99]"
                type="submit"
              >
                <Check className="size-5" />
                Guardar cambios
              </button>
            </div>
          </form>
        ) : null}
      </BottomSheet>

      <button
        aria-label="Nuevo barbero"
        className="fixed bottom-[96px] right-4 z-40 flex size-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 transition hover:scale-105 active:scale-95 md:bottom-8 md:right-8"
        onClick={() => setNewOpen(true)}
        type="button"
      >
        <Plus className="size-6" />
      </button>
    </main>
  );
}
