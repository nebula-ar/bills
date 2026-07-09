"use client";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { copyText } from "@/lib/clipboard";
import { Check, Copy, Link2, Monitor, Smartphone, Tag, X, type LucideIcon } from "@/components/icons";
import { useState } from "react";

type Barber = { id: string; name: string };
type CustomTerminal = { id: string; name: string };

type Terminal = {
  key: string;
  label: string;
  hint: string;
  path: string;
  icon: LucideIcon;
};

function TerminalRow({ terminal }: { terminal: Terminal }) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const Icon = terminal.icon;

  async function handleCopy() {
    const full = `${window.location.origin}${terminal.path}`;
    setUrl(full);
    const ok = await copyText(full);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1900);
    }
  }

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
        <button
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-black transition active:scale-95 ${
            copied ? "bg-emerald-100 text-emerald-700" : "bg-blue-600 text-white"
          }`}
          onClick={handleCopy}
          type="button"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      {url ? (
        <p className="mt-2 select-all break-all rounded-lg bg-white px-2.5 py-1.5 text-[0.68rem] font-semibold text-slate-500">
          {url}
        </p>
      ) : null}
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

  const terminals: Terminal[] = [
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
    ...customTerminals.map((terminal) => ({
      key: terminal.id,
      label: terminal.name,
      hint: "Elegí barbero y PIN",
      path: `/barber?terminal=${terminal.id}`,
      icon: Tag,
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
            {terminals.map((terminal) => (
              <TerminalRow key={terminal.key} terminal={terminal} />
            ))}
            <p className="px-1 pt-1 text-xs text-slate-400">Para crear o editar terminales, andá a «Más → Terminales».</p>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
