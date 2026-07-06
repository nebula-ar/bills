"use client";

import { createTerminalAction, deleteTerminalAction, renameTerminalAction } from "@/app/pos/actions";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Check, Copy, Link2, Monitor, Pencil, Plus, Smartphone, Tag, Trash2, X, type LucideIcon } from "lucide-react";
import { useState, useTransition } from "react";

type Barber = { id: string; name: string };
type CustomTerminal = { id: string; name: string; active: boolean };

type Terminal = {
  key: string;
  label: string;
  hint: string;
  path: string;
  icon: LucideIcon;
};

async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Cae al fallback (por ej. HTTP sin contexto seguro, como la IP de LAN).
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

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
  if (!url) {
    return null;
  }
  return (
    <p className="mt-2 select-all break-all rounded-lg bg-white px-2.5 py-1.5 text-[0.68rem] font-semibold text-slate-500">
      {url}
    </p>
  );
}

function AutoTerminalRow({ terminal }: { terminal: Terminal }) {
  const { copied, url, copy } = useCopy();
  const Icon = terminal.icon;

  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-blue-700 ring-1 ring-slate-950/5">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-slate-950">{terminal.label}</p>
          <p className="truncate text-xs text-slate-500">{terminal.hint}</p>
        </div>
        <CopyButton copied={copied} onClick={() => copy(terminal.path)} />
      </div>
      <RevealedUrl url={url} />
    </div>
  );
}

function CustomTerminalRow({ terminal }: { terminal: CustomTerminal }) {
  const { copied, url, copy } = useCopy();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(terminal.name);
  const [isPending, startTransition] = useTransition();
  const path = `/barber?terminal=${terminal.id}`;

  function save() {
    const next = name.trim();
    if (!next) {
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      formData.set("terminalId", terminal.id);
      formData.set("name", next);
      await renameTerminalAction(formData);
      setEditing(false);
    });
  }

  function remove() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("terminalId", terminal.id);
      await deleteTerminalAction(formData);
    });
  }

  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-950 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            maxLength={40}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
          <button
            aria-label="Guardar"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-600 text-white transition active:scale-90 disabled:opacity-50"
            disabled={isPending}
            onClick={save}
            type="button"
          >
            <Check className="size-4" />
          </button>
          <button
            aria-label="Cancelar"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-200 text-slate-600 transition active:scale-90"
            onClick={() => {
              setName(terminal.name);
              setEditing(false);
            }}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-blue-700 ring-1 ring-slate-950/5">
            <Tag className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-slate-950">{terminal.name}</p>
            <p className="truncate text-xs text-slate-500">Elegí barbero y PIN</p>
          </div>
          <button
            aria-label="Renombrar"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-slate-500 ring-1 ring-slate-950/5 transition active:scale-90"
            onClick={() => setEditing(true)}
            type="button"
          >
            <Pencil className="size-4" />
          </button>
          <button
            aria-label="Borrar"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-rose-500 ring-1 ring-slate-950/5 transition active:scale-90 disabled:opacity-50"
            disabled={isPending}
            onClick={remove}
            type="button"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      )}
      {!editing ? (
        <div className="mt-2 flex items-center justify-end">
          <CopyButton copied={copied} onClick={() => copy(path)} />
        </div>
      ) : null}
      <RevealedUrl url={url} />
    </div>
  );
}

function AddTerminal({ branchId }: { branchId: string }) {
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  function create() {
    const next = name.trim();
    if (!next) {
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      formData.set("branchId", branchId);
      formData.set("name", next);
      await createTerminalAction(formData);
      setName("");
    });
  }

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white p-2.5">
      <input
        className="min-w-0 flex-1 rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-950 outline-none focus:bg-white focus:ring-2 focus:ring-blue-100"
        maxLength={40}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            create();
          }
        }}
        placeholder="Nueva terminal (ej: Silla 3)"
        value={name}
      />
      <button
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-blue-600 px-3.5 py-2.5 text-xs font-black text-white transition active:scale-95 disabled:opacity-50"
        disabled={isPending || name.trim().length === 0}
        onClick={create}
        type="button"
      >
        <Plus className="size-3.5" />
        Agregar
      </button>
    </div>
  );
}

export function PosTerminals({
  branch,
  customTerminals,
}: {
  branch: { id: string; name: string; barbers: Barber[] };
  customTerminals: CustomTerminal[];
}) {
  const [open, setOpen] = useState(false);

  const autoTerminals: Terminal[] = [
    {
      key: "mostrador",
      label: "Mostrador",
      hint: "El barbero elige su perfil y pone su PIN",
      path: `/barber?branch=${branch.id}`,
      icon: Monitor,
    },
    ...branch.barbers.map((barber) => ({
      key: barber.id,
      label: `Teléfono de ${barber.name}`,
      hint: "Ya viene con su perfil; solo pone el PIN",
      path: `/barber?branch=${branch.id}&barber=${barber.id}`,
      icon: Smartphone,
    })),
  ];

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <button
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 transition active:scale-[0.99]"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Link2 className="size-4" />
        Links de terminales
        {customTerminals.length > 0 ? (
          <span className="rounded-full bg-blue-600 px-1.5 text-[0.65rem] text-white">{autoTerminals.length + customTerminals.length}</span>
        ) : null}
      </button>

      <BottomSheet onClose={() => setOpen(false)} open={open}>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between px-5 pt-6">
            <div className="min-w-0">
              <h3 className="text-xl font-black tracking-tight text-slate-950">Terminales</h3>
              <p className="truncate text-sm text-slate-500">{branch.name}</p>
            </div>
            <button
              aria-label="Cerrar"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:scale-90"
              onClick={() => setOpen(false)}
              type="button"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-5 pb-6 pt-4">
            <p className="rounded-2xl bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-700">
              Compartí el link de cada terminal con quien la usa. El barbero entra, pone su PIN y registra la venta.
            </p>

            {autoTerminals.map((terminal) => (
              <AutoTerminalRow key={terminal.key} terminal={terminal} />
            ))}

            <div className="pt-1">
              <p className="mb-2 px-1 text-xs font-black uppercase tracking-wide text-slate-400">Terminales propias</p>
              {customTerminals.map((terminal) => (
                <div className="mb-2.5" key={terminal.id}>
                  <CustomTerminalRow terminal={terminal} />
                </div>
              ))}
              <AddTerminal branchId={branch.id} />
            </div>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
