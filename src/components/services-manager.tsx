"use client";

import { createService, saveBranchServiceConfig } from "@/app/services/actions";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Check, CircleSlash, Plus, Scissors, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  configured: boolean;
  available: boolean;
  priceValue: string;
  priceLabel: string;
  statusLabel: string;
  statusTone: "available" | "unavailable" | "unconfigured";
};

export type ServicesData = {
  businessName: string;
  branches: { id: string; name: string }[];
  selectedBranchId: string;
  services: ServiceRow[];
  flash: { status: "success" | "error"; message: string } | null;
};

const toneClasses: Record<ServiceRow["statusTone"], string> = {
  available: "bg-emerald-50 text-emerald-700",
  unavailable: "bg-slate-100 text-slate-500",
  unconfigured: "bg-amber-50 text-amber-700",
};

export function ServicesManager({ data }: { data: ServicesData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newOpen, setNewOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const editing = data.services.find((service) => service.id === editId) ?? null;

  function selectBranch(id: string) {
    startTransition(() => router.push(`/services?branchId=${id}`, { scroll: false }));
  }

  return (
    <main className="mx-auto min-h-screen w-full min-w-0 max-w-[560px] overflow-x-clip bg-[#f6f7fb] px-4 pb-28 pt-6 text-slate-950">
      <header className="flex items-center justify-between gap-4 duration-500 animate-in fade-in slide-in-from-top-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-500">{data.businessName}</p>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight text-slate-950">Servicios</h1>
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

      {data.branches.length > 1 ? (
        <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 duration-500 animate-in fade-in slide-in-from-bottom-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {data.branches.map((branch) => (
            <button
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition active:scale-95 ${
                branch.id === data.selectedBranchId ? "bg-blue-600 text-white shadow-sm shadow-blue-600/25" : "bg-white text-slate-600 ring-1 ring-slate-950/5"
              }`}
              key={branch.id}
              onClick={() => selectBranch(branch.id)}
              type="button"
            >
              {branch.name}
            </button>
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

      <div className={`mt-4 ${isPending ? "pointer-events-none opacity-60 transition-opacity" : "transition-opacity"}`}>
        {data.services.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Todavía no hay servicios en el catálogo. Tocá «Nuevo» para crear el primero.
          </div>
        ) : (
          <ul className="space-y-2.5">
            {data.services.map((service, index) => (
              <li
                className="duration-500 animate-in fade-in slide-in-from-bottom-2"
                key={service.id}
                style={{ animationDelay: `${Math.min(index * 40, 320)}ms`, animationFillMode: "backwards" }}
              >
                <button
                  className="flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-sm ring-1 ring-slate-950/5 transition active:scale-[0.99]"
                  onClick={() => setEditId(service.id)}
                  type="button"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <Scissors className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-slate-950">{service.name}</p>
                    <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[0.7rem] font-bold ${toneClasses[service.statusTone]}`}>
                      {service.statusLabel}
                    </span>
                  </div>
                  <p className="shrink-0 text-right text-sm font-black text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {service.priceLabel}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Nuevo servicio */}
      <BottomSheet onClose={() => setNewOpen(false)} open={newOpen}>
        <form action={createService} className="flex min-h-0 flex-1 flex-col">
          <input name="branchId" type="hidden" value={data.selectedBranchId} />
          <div className="flex items-center justify-between px-5 pt-6">
            <h3 className="text-xl font-black tracking-tight text-slate-950">Nuevo servicio</h3>
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
                autoFocus
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                name="name"
                placeholder="Ej: Corte clásico"
                required
                type="text"
              />
            </label>
            <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
              Descripción (opcional)
              <input
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                name="description"
                placeholder="Ej: incluye lavado"
                type="text"
              />
            </label>
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
              Se agrega al catálogo del negocio. Después ponele precio en cada sucursal para poder venderlo.
            </p>
          </div>
          <div className="mt-auto border-t border-slate-100 px-5 pb-1 pt-4">
            <button
              className="w-full rounded-2xl bg-blue-600 px-4 py-4 text-base font-black text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.99]"
              type="submit"
            >
              Agregar al catálogo
            </button>
          </div>
        </form>
      </BottomSheet>

      {/* Configurar precio/disponibilidad */}
      <BottomSheet onClose={() => setEditId(null)} open={editing !== null}>
        {editing ? (
          <form action={saveBranchServiceConfig} className="flex min-h-0 flex-1 flex-col">
            <input name="branchId" type="hidden" value={data.selectedBranchId} />
            <input name="serviceId" type="hidden" value={editing.id} />
            <div className="flex items-start justify-between gap-3 px-5 pt-6">
              <div className="min-w-0">
                <h3 className="text-xl font-black tracking-tight text-slate-950">{editing.name}</h3>
                {editing.description ? <p className="mt-0.5 truncate text-sm text-slate-500">{editing.description}</p> : null}
              </div>
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
              {!editing.configured ? (
                <p className="flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
                  <CircleSlash className="size-4" />
                  Sin precio en esta sucursal — cargalo para poder venderlo.
                </p>
              ) : null}
              <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                Precio en esta sucursal
                <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-blue-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100">
                  <span className="text-lg font-black text-slate-400">$</span>
                  <input
                    className="w-full bg-transparent px-2 py-3.5 text-lg font-black text-slate-950 outline-none"
                    defaultValue={editing.priceValue}
                    inputMode="numeric"
                    min={1}
                    name="price"
                    placeholder="0"
                    required
                    step={1}
                    type="number"
                  />
                </div>
              </label>
              <label className="flex cursor-pointer items-center justify-between rounded-2xl bg-slate-50 px-4 py-3.5">
                <span className="text-sm font-black text-slate-950">Disponible para vender</span>
                <input className="peer sr-only" defaultChecked={editing.available || !editing.configured} name="active" type="checkbox" />
                <span className="relative h-7 w-12 rounded-full bg-slate-300 transition-colors peer-checked:bg-emerald-500">
                  <span className="absolute left-1 top-1 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
                </span>
              </label>
            </div>
            <div className="mt-auto border-t border-slate-100 px-5 pb-1 pt-4">
              <button
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 text-base font-black text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.99]"
                type="submit"
              >
                <Check className="size-5" />
                {editing.configured ? "Guardar cambios" : "Habilitar en esta sucursal"}
              </button>
            </div>
          </form>
        ) : null}
      </BottomSheet>
    </main>
  );
}
