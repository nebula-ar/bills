"use client";

import { createTerminalAction, deleteTerminalAction, renameTerminalAction } from "@/app/terminals/actions";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { copyText } from "@/lib/clipboard";
import { Check, Copy, Monitor, Pencil, Plus, Smartphone, Tag, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ComponentType } from "react";

export type TerminalsBranch = {
  id: string;
  name: string;
  barbers: { id: string; name: string }[];
  customTerminals: { id: string; name: string }[];
};

export type TerminalsData = {
  businessName: string;
  branches: TerminalsBranch[];
  selectedBranchId: string;
  flash: { status: "success" | "error"; message: string } | null;
};

function useCopy() {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  async function copy(path: string) {
    const full = `${window.location.origin}${path}`;
    setUrl(full);
    const ok = await copyText(full);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1900);
    }
  }

  return { copied, url, copy };
}

function CopyButton({ copied, onClick }: { copied: boolean; onClick: () => void }) {
  return (
    <button
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-black transition active:scale-95 ${
        copied ? "bg-emerald-100 text-emerald-700" : "bg-blue-600 text-white"
      }`}
      onClick={onClick}
      type="button"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

function RevealedUrl({ url }: { url: string | null }) {
  if (!url) return null;
  return (
    <p className="mt-2 select-all break-all rounded-lg bg-white px-2.5 py-1.5 text-[0.68rem] font-semibold text-slate-500">
      {url}
    </p>
  );
}

function AutoRow({ icon: Icon, name, hint, path }: { icon: ComponentType<{ className?: string }>; name: string; hint: string; path: string }) {
  const { copied, url, copy } = useCopy();
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-blue-700 ring-1 ring-slate-950/5">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-slate-950">{name}</p>
          <p className="truncate text-xs text-slate-500">{hint}</p>
        </div>
        <CopyButton copied={copied} onClick={() => copy(path)} />
      </div>
      <RevealedUrl url={url} />
    </div>
  );
}

function CustomRow({ terminal, onEdit }: { terminal: { id: string; name: string }; onEdit: () => void }) {
  const { copied, url, copy } = useCopy();
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-950/5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
          <Tag className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-slate-950">{terminal.name}</p>
          <p className="truncate text-xs text-slate-500">Elegí barbero y PIN</p>
        </div>
        <button
          aria-label="Editar"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 transition active:scale-90"
          onClick={onEdit}
          type="button"
        >
          <Pencil className="size-4" />
        </button>
        <CopyButton copied={copied} onClick={() => copy(`/barber?terminal=${terminal.id}`)} />
      </div>
      <RevealedUrl url={url} />
    </div>
  );
}

export function TerminalsManager({ data }: { data: TerminalsData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newOpen, setNewOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const branch = data.branches.find((item) => item.id === data.selectedBranchId) ?? data.branches[0] ?? null;
  const editing = branch?.customTerminals.find((terminal) => terminal.id === editId) ?? null;

  function selectBranch(id: string) {
    startTransition(() => router.push(`/terminals?branchId=${id}`, { scroll: false }));
  }

  return (
    <main className="mx-auto min-h-screen w-full min-w-0 max-w-[560px] overflow-x-clip bg-[#f6f7fb] px-4 pb-28 pt-6 text-slate-950">
      <header className="flex items-center justify-between gap-4 duration-500 animate-in fade-in slide-in-from-top-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-500">{data.businessName}</p>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight text-slate-950">Terminales</h1>
        </div>
        {branch ? (
          <button
            className="flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-black text-white shadow-sm shadow-blue-600/25 transition active:scale-95"
            onClick={() => setNewOpen(true)}
            type="button"
          >
            <Plus className="size-4" />
            Nueva
          </button>
        ) : null}
      </header>

      {data.branches.length > 1 ? (
        <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {data.branches.map((item) => (
            <button
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition active:scale-95 ${
                item.id === data.selectedBranchId ? "bg-blue-600 text-white shadow-sm shadow-blue-600/25" : "bg-white text-slate-600 ring-1 ring-slate-950/5"
              }`}
              key={item.id}
              onClick={() => selectBranch(item.id)}
              type="button"
            >
              {item.name}
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

      {!branch ? (
        <div className="mt-6 rounded-[1.5rem] border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Cargá una sucursal activa para administrar sus terminales.
        </div>
      ) : (
        <div className={`mt-4 space-y-5 ${isPending ? "pointer-events-none opacity-60 transition-opacity" : "transition-opacity"}`}>
          {/* Propias */}
          <section>
            <p className="mb-2 px-1 text-xs font-black uppercase tracking-wide text-slate-500">Terminales propias</p>
            {branch.customTerminals.length === 0 ? (
              <button
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm font-black text-blue-600 transition active:scale-[0.99]"
                onClick={() => setNewOpen(true)}
                type="button"
              >
                <Plus className="size-4" />
                Crear terminal (ej: Silla 3, Recepción)
              </button>
            ) : (
              <div className="space-y-2.5">
                {branch.customTerminals.map((terminal) => (
                  <CustomRow key={terminal.id} onEdit={() => setEditId(terminal.id)} terminal={terminal} />
                ))}
              </div>
            )}
          </section>

          {/* Automáticas */}
          <section>
            <p className="mb-2 px-1 text-xs font-black uppercase tracking-wide text-slate-500">Automáticas</p>
            <div className="space-y-2.5">
              <AutoRow
                hint="El barbero elige su perfil y pone su PIN"
                icon={Monitor}
                name="Mostrador"
                path={`/barber?branch=${branch.id}`}
              />
              {branch.barbers.map((barber) => (
                <AutoRow
                  hint="Ya viene con su perfil; solo pone el PIN"
                  icon={Smartphone}
                  key={barber.id}
                  name={`Teléfono de ${barber.name}`}
                  path={`/barber?branch=${branch.id}&barber=${barber.id}`}
                />
              ))}
            </div>
            <p className="mt-2 px-1 text-xs text-slate-400">Estas se generan solas. Compartí el link con quien la usa.</p>
          </section>
        </div>
      )}

      {/* Nueva terminal */}
      <BottomSheet onClose={() => setNewOpen(false)} open={newOpen}>
        {branch ? (
          <form action={createTerminalAction} className="flex min-h-0 flex-1 flex-col">
            <input name="branchId" type="hidden" value={branch.id} />
            <div className="flex items-center justify-between px-5 pt-6">
              <div className="min-w-0">
                <h3 className="text-xl font-black tracking-tight text-slate-950">Nueva terminal</h3>
                <p className="truncate text-sm text-slate-500">{branch.name}</p>
              </div>
              <button
                aria-label="Cerrar"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:scale-90"
                onClick={() => setNewOpen(false)}
                type="button"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5">
              <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                Nombre
                <input
                  autoFocus
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-bold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  maxLength={40}
                  name="name"
                  placeholder="Ej: Silla 3, Recepción, Caja tablet"
                  required
                  type="text"
                />
              </label>
              <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
                Funciona como un mostrador con nombre propio: el barbero entra, elige su perfil y pone su PIN. Cada venta
                queda registrada en esta terminal.
              </p>
            </div>
            <div className="mt-auto border-t border-slate-100 px-5 pb-1 pt-4">
              <button
                className="w-full rounded-2xl bg-blue-600 px-4 py-4 text-base font-black text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.99]"
                type="submit"
              >
                Crear terminal
              </button>
            </div>
          </form>
        ) : null}
      </BottomSheet>

      {/* Editar terminal */}
      <BottomSheet onClose={() => setEditId(null)} open={editing !== null}>
        {editing && branch ? (
          <div className="flex min-h-0 flex-1 flex-col" key={editing.id}>
            <div className="flex items-center justify-between px-5 pt-6">
              <h3 className="text-xl font-black tracking-tight text-slate-950">Editar terminal</h3>
              <button
                aria-label="Cerrar"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:scale-90"
                onClick={() => setEditId(null)}
                type="button"
              >
                <X className="size-5" />
              </button>
            </div>
            <form action={renameTerminalAction} className="flex min-h-0 flex-1 flex-col">
              <input name="branchId" type="hidden" value={branch.id} />
              <input name="terminalId" type="hidden" value={editing.id} />
              <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5">
                <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                  Nombre
                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-bold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    defaultValue={editing.name}
                    maxLength={40}
                    name="name"
                    required
                    type="text"
                  />
                </label>
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
              <form action={deleteTerminalAction}>
                <input name="branchId" type="hidden" value={branch.id} />
                <input name="terminalId" type="hidden" value={editing.id} />
                <button
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-600 transition active:scale-[0.99]"
                  type="submit"
                >
                  <Trash2 className="size-4" />
                  Borrar terminal
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </BottomSheet>
    </main>
  );
}
