"use client";

import { ArrowUpRight, Check, Copy } from "@/components/icons";
import { useState } from "react";
import { toast } from "sonner";

// Compartir el presupuesto.
//
// El link público es lo que hace que esto sirva: el cliente lo abre desde el
// WhatsApp, sin cuenta y sin instalar nada, y ve el mismo detalle que el
// mostrador. Copiar al portapapeles es el plan B cuando no hay teléfono cargado.

export function QuoteShare({
  token,
  phone,
  number,
  total,
}: {
  token: string;
  phone: string | null;
  number: number;
  total: number;
}) {
  const [copied, setCopied] = useState(false);

  const url = typeof window === "undefined" ? "" : `${window.location.origin}/p/${token}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/p/${token}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin HTTPS el portapapeles no existe: mostramos el link para copiarlo a mano.
      toast.message(`${window.location.origin}/p/${token}`);
    }
  }

  const message = encodeURIComponent(
    `Hola! Te paso el presupuesto #${number} por ${new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(total)}: `,
  );

  // Sin teléfono, wa.me abre igual y deja elegir el contacto.
  const whatsapp = `https://wa.me/${(phone ?? "").replace(/\D/g, "")}?text=${message}${encodeURIComponent(url)}`;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <a
        className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white transition active:scale-95"
        href={whatsapp}
        rel="noreferrer"
        target="_blank"
      >
        <ArrowUpRight className="size-3.5" />
        WhatsApp
      </a>
      <button
        className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 transition active:scale-95"
        onClick={copy}
        type="button"
      >
        {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
        {copied ? "Copiado" : "Copiar link"}
      </button>
    </div>
  );
}
