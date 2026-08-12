"use client";

import { createStaff, updateStaff } from "@/app/staff/actions";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Check, DynamicIcon, KeyRound, MapPin, Plus, X } from "@/components/icons";
import { useState } from "react";
import { SelectField } from "@/components/ui/select-field";

export type StaffRow = {
  id: string;
  name: string;
  branchId: string | null;
  branchLabel: string;
  active: boolean;
  canCloseCash: boolean;
  commissionRate: number;
  hasPin: boolean;
};

export type StaffBranch = {
  id: string;
  name: string;
};

export type StaffsData = {
  // Cómo llama este rubro a quien atiende ("Barbero" / "Vendedor") y con qué
  // icono se lo representa (ver src/lib/vertical.ts).
  staffSingular: string;
  staffPlural: string;
  staffIcon: string;
  // Solo se muestra el campo de comisión si el módulo está prendido.
  showsCommissions: boolean;
  businessName: string;
  staffs: StaffRow[];
  branches: StaffBranch[];
  flash: { status: "success" | "error"; message: string } | null;
};

function BranchField({
  branches,
  defaultValue,
  includeEmpty,
}: {
  branches: StaffBranch[];
  defaultValue?: string;
  includeEmpty?: boolean;
}) {
  return (
    <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
      Sucursal
      <div className="relative">
        {/* Sin `required` nativo: el desplegable propio manda el valor por un
            input oculto. La sucursal vacía la rechaza el servidor
            (src/app/staff/actions.ts), así que no entra un dato malo. */}
        <SelectField
          ariaLabel="Sucursal"
          defaultValue={defaultValue}
          name="branchId"
          options={[
            ...(includeEmpty ? [{ value: "", label: "Elegí una sucursal" }] : []),
            ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
          ]}
        />
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
        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-bold tracking-[0.3em] text-slate-950 outline-none transition placeholder:tracking-normal placeholder:font-semibold focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15"
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
        <span className="text-sm font-black text-slate-950">Activo</span>
        <p className="mt-0.5 text-xs text-slate-500">Si lo desactivás, no aparece para cargar ventas.</p>
      </div>
      {on ? <input name="active" type="hidden" value="on" /> : null}
      <button
        aria-checked={on}
        aria-label="Activo"
        className={`relative h-11 w-12 shrink-0 rounded-full transition-colors duration-200 ${on ? "bg-emerald-500" : "bg-slate-300"}`}
        onClick={() => setOn((value) => !value)}
        role="switch"
        type="button"
      >
        <span
          className="absolute left-1 top-1/2 size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-[cubic-bezier(.34,1.56,.64,1)]"
          style={{ transform: on ? "translateY(-50%) translateX(1.25rem)" : "translateY(-50%) translateX(0)" }}
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
        className={`relative h-11 w-12 shrink-0 rounded-full transition-colors duration-200 ${on ? "bg-primary" : "bg-slate-300"}`}
        onClick={() => setOn((value) => !value)}
        role="switch"
        type="button"
      >
        <span
          className="absolute left-1 top-1/2 size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-[cubic-bezier(.34,1.56,.64,1)]"
          style={{ transform: on ? "translateY(-50%) translateX(1.25rem)" : "translateY(-50%) translateX(0)" }}
        />
      </button>
    </div>
  );
}

export function StaffsManager({ data }: { data: StaffsData }) {
  const [newOpen, setNewOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const editing = data.staffs.find((staff) => staff.id === editId) ?? null;
  const noBranches = data.branches.length === 0;

  return (
    <main className="mx-auto min-h-dvh w-full min-w-0 max-w-[560px] overflow-x-clip bg-[var(--background)] px-4 pb-[calc(env(safe-area-inset-bottom)+7rem)] pt-6 text-slate-950 lg:max-w-none lg:px-8 duration-300 animate-in fade-in">
      <header className="flex items-center justify-between gap-4 duration-500 animate-in fade-in slide-in-from-top-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-500">{data.businessName}</p>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight text-slate-950">{data.staffPlural}</h1>
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
        {data.staffs.length === 0 ? (
          <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/50 p-10 text-center">
            <div className="mb-4 flex size-20 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-950/5">
              <DynamicIcon className="size-8 text-slate-300" name={data.staffIcon} />
            </div>
            <p className="text-sm font-bold text-slate-600">Todavía no hay {data.staffPlural.toLowerCase()}</p>
            <p className="mt-1 text-xs text-slate-500">Tocá el botón «+» abajo para cargar el primero.</p>
          </div>
        ) : (
          <ul className="space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
            {data.staffs.map((staff, index) => (
              <li
                className="duration-500 animate-in fade-in slide-in-from-bottom-2"
                key={staff.id}
                style={{ animationDelay: `${Math.min(index * 40, 320)}ms`, animationFillMode: "backwards" }}
              >
                <button
                  className="flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-sm ring-1 ring-slate-950/5 transition active:scale-[0.99]"
                  onClick={() => setEditId(staff.id)}
                  type="button"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <DynamicIcon className="size-5" name={data.staffIcon} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-slate-950">{staff.name}</p>
                    <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
                      <MapPin className="size-3 shrink-0" />
                      {staff.branchLabel}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[0.7rem] font-bold ${
                        staff.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {staff.active ? "Activo" : "Inactivo"}
                    </span>
                    {staff.canCloseCash ? (
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[0.7rem] font-bold text-primary">Encargado</span>
                    ) : null}
                    {!staff.hasPin ? (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[0.7rem] font-bold text-amber-700">Sin PIN</span>
                    ) : null}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Alta de quien atiende */}
      <BottomSheet onClose={() => setNewOpen(false)} open={newOpen}>
        <form action={createStaff} className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between px-5 pt-6">
            <h3 className="text-xl font-black tracking-tight text-slate-950">Nuevo {data.staffSingular.toLowerCase()}</h3>
            <button
              aria-label="Cerrar"
              className="flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-90"
              onClick={() => setNewOpen(false)}
              type="button"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pt-5">
            {noBranches ? (
              <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
                {`Primero creá una sucursal activa para poder cargar ${data.staffPlural.toLowerCase()}.`}
              </p>
            ) : (
              <>
                <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                  Nombre
                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15"
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
                  {`El PIN le sirve al ${data.staffSingular.toLowerCase()} para identificarse al cargar ventas. Se guarda protegido.`}
                </p>
                <CashCloseToggle defaultOn={false} />
              </>
            )}
          </div>
          {!noBranches ? (
            <div className="mt-auto border-t border-slate-100 px-5 pb-1 pt-4">
              <button
                className="w-full rounded-2xl bg-primary px-4 py-4 text-base font-black text-white shadow-sm shadow-primary/25 transition hover:bg-primary-strong active:scale-[0.99]"
                type="submit"
              >
                Crear {data.staffSingular.toLowerCase()}
              </button>
            </div>
          ) : null}
        </form>
      </BottomSheet>

      {/* Edición */}
      <BottomSheet onClose={() => setEditId(null)} open={editing !== null}>
        {editing ? (
          <form action={updateStaff} className="flex min-h-0 flex-1 flex-col" key={editing.id}>
            <input name="staffId" type="hidden" value={editing.id} />
            <div className="flex items-start justify-between gap-3 px-5 pt-6">
              <h3 className="text-xl font-black tracking-tight text-slate-950">Editar {data.staffSingular.toLowerCase()}</h3>
              <button
                aria-label="Cerrar"
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-90"
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
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-bold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15"
                  defaultValue={editing.name}
                  name="name"
                  required
                  type="text"
                />
              </label>
              <BranchField branches={data.branches} defaultValue={editing.branchId ?? ""} includeEmpty={!editing.branchId} />
              <PinField label="Nuevo PIN (opcional)" />
              <p className="text-xs text-slate-500">
                {editing.hasPin
                  ? "Dejá el PIN vacío para mantener el actual."
                  : `Este ${data.staffSingular.toLowerCase()} todavía no tiene PIN — cargá uno.`}
              </p>
              <ActiveToggle defaultOn={editing.active} />
              <CashCloseToggle defaultOn={editing.canCloseCash} />
              {data.showsCommissions ? (
                <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                  Comisión sobre lo que vende
                  <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-primary/40 focus-within:bg-white">
                    <input
                      className="w-full bg-transparent py-3.5 text-lg font-black text-slate-950 outline-none"
                      defaultValue={editing.commissionRate || ""}
                      inputMode="numeric"
                      max={100}
                      min={0}
                      name="commissionRate"
                      placeholder="0"
                      type="number"
                    />
                    <span className="text-lg font-black text-slate-600">%</span>
                  </div>
                  <span className="text-xs font-medium normal-case tracking-normal text-slate-500">
                    Se calcula sobre el total cobrado. Mirá la liquidación en Comisiones.
                  </span>
                </label>
              ) : null}
            </div>
            <div className="mt-auto border-t border-slate-100 px-5 pb-1 pt-4">
              <button
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-base font-black text-white shadow-sm shadow-primary/25 transition hover:bg-primary-strong active:scale-[0.99]"
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
        aria-label={`Nuevo ${data.staffSingular.toLowerCase()}`}
        className="fixed bottom-[96px] right-4 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/30 transition hover:scale-105 active:scale-95 md:bottom-8 md:right-8"
        onClick={() => setNewOpen(true)}
        type="button"
      >
        <Plus className="size-6" />
      </button>
    </main>
  );
}
