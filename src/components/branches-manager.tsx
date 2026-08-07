"use client";

import { createBranch, updateBranch } from "@/app/branches/actions";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Check, MapPin, Plus, Store, X } from "@/components/icons";
import { useState } from "react";

export type BranchRow = {
  id: string;
  name: string;
  address: string | null;
  active: boolean;
};

export type BranchesData = {
  businessName: string;
  branches: BranchRow[];
  flash: { status: "success" | "error"; message: string } | null;
};

function ActiveToggle({ defaultOn }: { defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn);

  return (
    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3.5">
      <div className="min-w-0">
        <span className="text-sm font-black text-slate-950">Sucursal activa</span>
        <p className="mt-0.5 text-xs text-slate-500">Si la desactivás, no aparece para vender ni configurar.</p>
      </div>
      {on ? <input name="active" type="hidden" value="on" /> : null}
      <button
        aria-checked={on}
        aria-label="Sucursal activa"
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

export function BranchesManager({ data }: { data: BranchesData }) {
  const [newOpen, setNewOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const editing = data.branches.find((branch) => branch.id === editId) ?? null;

  return (
    <main className="mx-auto min-h-screen w-full min-w-0 max-w-[560px] overflow-x-clip bg-[var(--background)] px-4 pb-28 pt-6 text-slate-950 lg:max-w-none lg:px-8">
      <header className="flex items-center justify-between gap-4 duration-500 animate-in fade-in slide-in-from-top-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-500">{data.businessName}</p>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight text-slate-950">Sucursales</h1>
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
        {data.branches.length === 0 ? (
          <div className="mt-8 flex flex-col items-center justify-center rounded-[2rem] border border-dashed border-slate-200 bg-white/50 p-10 text-center">
            <div className="mb-4 flex size-20 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-950/5">
              <Store className="size-8 text-slate-300" />
            </div>
            <p className="text-sm font-bold text-slate-600">No hay sucursales</p>
            <p className="mt-1 text-xs text-slate-400">Tocá el botón «+» abajo para crear la primera.</p>
          </div>
        ) : (
          <ul className="space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
            {data.branches.map((branch, index) => (
              <li
                className="duration-500 animate-in fade-in slide-in-from-bottom-2"
                key={branch.id}
                style={{ animationDelay: `${Math.min(index * 40, 320)}ms`, animationFillMode: "backwards" }}
              >
                <button
                  className="flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-sm ring-1 ring-slate-950/5 transition active:scale-[0.99]"
                  onClick={() => setEditId(branch.id)}
                  type="button"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Store className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-slate-950">{branch.name}</p>
                    <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
                      <MapPin className="size-3 shrink-0" />
                      {branch.address ? branch.address : "Sin dirección"}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[0.7rem] font-bold ${
                      branch.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {branch.active ? "Activa" : "Inactiva"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Nueva sucursal */}
      <BottomSheet onClose={() => setNewOpen(false)} open={newOpen}>
        <form action={createBranch} className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between px-5 pt-6">
            <h3 className="text-xl font-black tracking-tight text-slate-950">Nueva sucursal</h3>
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
            <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
              Nombre
              <input
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15"
                name="name"
                placeholder="Ej: Sucursal Centro"
                required
                type="text"
              />
            </label>
            <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
              Dirección (opcional)
              <input
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15"
                name="address"
                placeholder="Ej: Av. Rivadavia 1234"
                type="text"
              />
            </label>
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
              La sucursal nueva queda activa. Después cargale precios de servicios y empleados.
            </p>
          </div>
          <div className="mt-auto border-t border-slate-100 px-5 pb-1 pt-4">
            <button
              className="w-full rounded-2xl bg-primary px-4 py-4 text-base font-black text-white shadow-sm shadow-primary/25 transition hover:bg-primary-strong active:scale-[0.99]"
              type="submit"
            >
              Crear sucursal
            </button>
          </div>
        </form>
      </BottomSheet>

      {/* Editar sucursal */}
      <BottomSheet onClose={() => setEditId(null)} open={editing !== null}>
        {editing ? (
          <form action={updateBranch} className="flex min-h-0 flex-1 flex-col" key={editing.id}>
            <input name="branchId" type="hidden" value={editing.id} />
            <div className="flex items-start justify-between gap-3 px-5 pt-6">
              <h3 className="text-xl font-black tracking-tight text-slate-950">Editar sucursal</h3>
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
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-bold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15"
                  defaultValue={editing.name}
                  name="name"
                  required
                  type="text"
                />
              </label>
              <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                Dirección (opcional)
                <input
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15"
                  defaultValue={editing.address ?? ""}
                  name="address"
                  placeholder="Ej: Av. Rivadavia 1234"
                  type="text"
                />
              </label>
              <ActiveToggle defaultOn={editing.active} />
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
        aria-label="Nueva sucursal"
        className="fixed bottom-[96px] right-4 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/30 transition hover:scale-105 active:scale-95 md:bottom-8 md:right-8"
        onClick={() => setNewOpen(true)}
        type="button"
      >
        <Plus className="size-6" />
      </button>
    </main>
  );
}
