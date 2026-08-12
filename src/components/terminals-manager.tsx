"use client";

import { createTerminalAction, deleteTerminalAction, renameTerminalAction } from "@/app/terminals/actions";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { PageEnter } from "@/components/page-enter";
import { Skeleton } from "@/components/ui/skeleton";
import { copyText } from "@/lib/clipboard";
import { Check, Copy, Monitor, Pencil, Plus, Smartphone, Tag, Trash2, X } from "@/components/icons";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ComponentType } from "react";
import { SelectField } from "@/components/ui/select-field";

type Staff = { id: string; name: string };
type CustomTerminal = { id: string; name: string; staffId: string | null; staffName: string | null };

export type TerminalsBranch = {
  id: string;
  name: string;
  staffs: Staff[];
  customTerminals: CustomTerminal[];
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
        copied ? "bg-emerald-100 text-emerald-700" : "bg-primary text-white"
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
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-primary ring-1 ring-slate-950/5">
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

function CustomRow({ terminal, onEdit }: { terminal: CustomTerminal; onEdit: () => void }) {
  const { copied, url, copy } = useCopy();
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-950/5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Tag className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-slate-950">{terminal.name}</p>
          <p className="truncate text-xs text-slate-500">
            {terminal.staffName ? `Fija a ${terminal.staffName} · solo PIN` : "Mostrador · elige empleado y PIN"}
          </p>
        </div>
        <button
          aria-label="Editar"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-90"
          onClick={onEdit}
          type="button"
        >
          <Pencil className="size-4" />
        </button>
        <CopyButton copied={copied} onClick={() => copy(`/staff?terminal=${terminal.id}`)} />
      </div>
      <RevealedUrl url={url} />
    </div>
  );
}

function Select({
  label,
  name,
  value,
  onChange,
  options,
}: {
  label: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
      {label}
      <SelectField ariaLabel={label} defaultValue={value} name={name} onChange={onChange} options={options} />
    </label>
  );
}

function TerminalForm({
  branches,
  defaultBranchId,
  defaultStaffId,
  defaultName,
  allowBranchChange,
}: {
  branches: TerminalsBranch[];
  defaultBranchId: string;
  defaultStaffId: string;
  defaultName: string;
  allowBranchChange: boolean;
}) {
  const [branchId, setBranchId] = useState(defaultBranchId);
  const [staffId, setStaffId] = useState(defaultStaffId);
  const branch = branches.find((item) => item.id === branchId) ?? branches[0];
  const staffs = branch?.staffs ?? [];

  return (
    <div className="space-y-4">
      <input name="branchId" type="hidden" value={branchId} />

      <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
        Nombre
        <input
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-bold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15"
          defaultValue={defaultName}
          maxLength={40}
          name="name"
          placeholder="Ej: Silla 3, Recepción, Caja tablet"
          required
          type="text"
        />
      </label>

      {allowBranchChange ? (
        <Select
          label="Sucursal"
          onChange={(value) => {
            setBranchId(value);
            setStaffId("");
          }}
          options={branches.map((item) => ({ value: item.id, label: item.name }))}
          value={branchId}
        />
      ) : (
        <div className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
          Sucursal
          <div className="rounded-2xl bg-slate-50 px-4 py-3.5 text-base font-bold text-slate-950">{branch?.name}</div>
        </div>
      )}

      {/* `key={branchId}`: cambiar de sucursal resetea el empleado a "" y el
          desplegable propio es interno-no-controlado, así que sin remontarlo
          seguiría mostrando el empleado de la sucursal anterior. */}
      <Select
        key={branchId}
        label="Empleado"
        name="staffId"
        onChange={setStaffId}
        options={[
          { value: "", label: "Cualquiera (mostrador)" },
          ...staffs.map((staff) => ({ value: staff.id, label: staff.name })),
        ]}
        value={staffId}
      />
      <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
        Si asignás un empleado, la terminal ya viene con su perfil y solo pide el PIN. Si la dejás en «Cualquiera»,
        funciona como mostrador (cada uno elige su perfil).
      </p>
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
    <PageEnter>
      <main className="mx-auto min-h-dvh w-full min-w-0 max-w-[560px] overflow-x-clip bg-[var(--background)] px-4 pb-[calc(env(safe-area-inset-bottom)+7rem)] pt-6 text-slate-950 lg:max-w-none lg:px-8">
      <header className="flex items-center justify-between gap-4 duration-500 animate-in fade-in slide-in-from-top-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-500">{data.businessName}</p>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight text-slate-950">Terminales</h1>
        </div>
      </header>

      {data.branches.length > 1 ? (
        <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {data.branches.map((item) => (
            <button
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition active:scale-95 ${
                item.id === data.selectedBranchId ? "bg-primary text-white shadow-sm shadow-primary/25" : "bg-white text-slate-600 ring-1 ring-slate-950/5"
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
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Cargá una sucursal activa para administrar sus terminales.
        </div>
      ) : (
        <div className={`mt-4 space-y-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5 lg:space-y-0 ${isPending ? "pointer-events-none opacity-60 transition-opacity" : "transition-opacity"}`}>
          {/* Propias */}
          <section>
            <p className="mb-2 px-1 text-xs font-black uppercase tracking-wide text-slate-500">Terminales propias</p>
            {branch.customTerminals.length === 0 ? (
              <button
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm font-black text-primary transition active:scale-[0.99]"
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
                hint="El empleado elige su perfil y pone su PIN"
                icon={Monitor}
                name="Mostrador"
                path={`/staff?branch=${branch.id}`}
              />
              {branch.staffs.map((staff) => (
                <AutoRow
                  hint="Ya viene con su perfil; solo pone el PIN"
                  icon={Smartphone}
                  key={staff.id}
                  name={`Teléfono de ${staff.name}`}
                  path={`/staff?branch=${branch.id}&staff=${staff.id}`}
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
            <div className="flex items-center justify-between px-5 pt-6">
              <h3 className="text-xl font-black tracking-tight text-slate-950">Nueva terminal</h3>
              <button
                aria-label="Cerrar"
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-90"
                onClick={() => setNewOpen(false)}
                type="button"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5">
              <TerminalForm
                allowBranchChange
                branches={data.branches}
                defaultStaffId=""
                defaultBranchId={branch.id}
                defaultName=""
              />
            </div>
            <div className="mt-auto border-t border-slate-100 px-5 pb-1 pt-4">
              <button
                className="w-full rounded-2xl bg-primary px-4 py-4 text-base font-black text-white shadow-sm shadow-primary/25 transition hover:bg-primary-strong active:scale-[0.99]"
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
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-90"
                onClick={() => setEditId(null)}
                type="button"
              >
                <X className="size-5" />
              </button>
            </div>
            <form action={renameTerminalAction} className="flex min-h-0 flex-1 flex-col">
              <input name="terminalId" type="hidden" value={editing.id} />
              <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5">
                <TerminalForm
                  allowBranchChange={false}
                  branches={data.branches}
                  defaultStaffId={editing.staffId ?? ""}
                  defaultBranchId={branch.id}
                  defaultName={editing.name}
                />
              </div>
              <div className="mt-auto border-t border-slate-100 px-5 pb-1 pt-4">
                <button
                  className="w-full rounded-2xl bg-primary px-4 py-4 text-base font-black text-white shadow-sm shadow-primary/25 transition hover:bg-primary-strong active:scale-[0.99]"
                  type="submit"
                >
                  Guardar cambios
                </button>
              </div>
            </form>
            <div className="px-5 pb-5">
              <ConfirmDeleteButton
                action={deleteTerminalAction}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-600 transition active:scale-[0.99]"
                confirmLabel="Sí, borrar"
                description={
                  <>
                    Se borra la terminal <span className="font-black">{editing.name}</span> y se va de todas las
                    cajas. No se puede deshacer.
                  </>
                }
                fields={{ terminalId: editing.id }}
                successMessage="Terminal borrada."
                title="¿Borrar la terminal?"
              >
                <Trash2 className="size-4" />
                Borrar terminal
              </ConfirmDeleteButton>
            </div>
          </div>
        ) : null}
      </BottomSheet>

      {branch ? (
        <button
          aria-label="Nueva terminal"
          className="fixed bottom-[96px] right-4 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/30 transition hover:scale-105 active:scale-95 md:bottom-8 md:right-8"
          onClick={() => setNewOpen(true)}
          type="button"
        >
          <Plus className="size-6" />
        </button>
      ) : null}
    </main>
    </PageEnter>
  );
}

// Estado skeleton de TerminalsManager: mismo shell, header, chips de sucursal
// y las dos secciones (propias / automáticas) que el componente real.
export function TerminalsManagerSkeleton() {
  return (
    <main className="mx-auto min-h-dvh w-full min-w-0 max-w-[560px] overflow-x-clip bg-[var(--background)] px-4 pb-[calc(env(safe-area-inset-bottom)+7rem)] pt-6 text-slate-950 lg:max-w-none lg:px-8">
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-7 w-36" />
        </div>
      </header>

      {/* Chips de sucursal */}
      <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {["w-28", "w-24", "w-20"].map((width, index) => (
          <Skeleton className={`h-9 shrink-0 rounded-full ${width}`} key={index} />
        ))}
      </div>

      <div className="mt-4 space-y-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5 lg:space-y-0">
        {/* Propias */}
        <section>
          <Skeleton className="mb-2 h-3 w-32" />
          <div className="space-y-2.5">
            {Array.from({ length: 2 }).map((_, index) => (
              <div className="flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-950/5" key={index}>
                <Skeleton className="size-11 shrink-0 rounded-2xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3 max-w-36" />
                  <Skeleton className="h-3 w-1/2 max-w-28" />
                </div>
                <Skeleton className="size-8 shrink-0 rounded-full" />
              </div>
            ))}
          </div>
        </section>

        {/* Automáticas */}
        <section>
          <Skeleton className="mb-2 h-3 w-28" />
          <div className="space-y-2.5">
            {Array.from({ length: 3 }).map((_, index) => (
              <div className="flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-950/5" key={index}>
                <Skeleton className="size-11 shrink-0 rounded-2xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/5 max-w-40" />
                  <Skeleton className="h-3 w-3/5 max-w-48" />
                </div>
                <Skeleton className="size-8 shrink-0 rounded-full" />
              </div>
            ))}
          </div>
          <Skeleton className="mt-2 h-3 w-64" />
        </section>
      </div>

      <Skeleton className="fixed bottom-[96px] right-4 z-40 size-14 rounded-full md:bottom-8 md:right-8" />
    </main>
  );
}
