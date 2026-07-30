"use client";

import { ArrowUpRight, Check, Copy } from "@/components/icons";
import { useState } from "react";
import { toast } from "sonner";

// El link público del negocio: copiarlo y compartirlo.
//
// Es lo único de la app pensado para traer gente que todavía no es cliente, así
// que lo importante es que se copie de un toque y se vea antes de compartirlo.

export function MarketingPublicLink({
  token,
  active,
  kind,
  businessName,
}: {
  token: string | null;
  active: boolean;
  kind: "booking" | "catalog";
  businessName: string;
}) {
  const [copied, setCopied] = useState(false);

  if (!token || !active) {
    return (
      <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
        Prendé «Página pública activa» abajo y guardá: ahí te damos el link.
      </p>
    );
  }

  const path = `/n/${token}`;
  const url = typeof window === "undefined" ? path : `${window.location.origin}${path}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin HTTPS no hay portapapeles: mostramos el link para copiarlo a mano.
      toast.message(url);
    }
  }

  const message = encodeURIComponent(
    kind === "booking"
      ? `Reservá tu turno en ${businessName}: ${url}`
      : `Mirá el catálogo de ${businessName}: ${url}`,
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3">
        <span className="min-w-0 flex-1 truncate font-mono text-sm text-slate-600">{url}</span>
        <button
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-600 ring-1 ring-slate-200 transition active:scale-95"
          onClick={copy}
          type="button"
        >
          {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white transition active:scale-95"
          href={`https://wa.me/?text=${message}`}
          rel="noreferrer"
          target="_blank"
        >
          <ArrowUpRight className="size-3.5" />
          Compartir por WhatsApp
        </a>
        <a
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 transition active:scale-95"
          href={path}
          rel="noreferrer"
          target="_blank"
        >
          <ArrowUpRight className="size-3.5" />
          Ver cómo la ve el cliente
        </a>
      </div>
    </div>
  );
}
