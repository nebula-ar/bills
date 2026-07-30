"use client";

import { ArrowUpRight } from "@/components/icons";
import { whatsappLink } from "@/modules/messaging/whatsapp.logic";

// Botón de WhatsApp. Es un `<a>` a wa.me y nada más: no hay API, no hay costo y
// funciona igual desde el celular que desde la compu con WhatsApp Web.

export function WhatsappButton({
  phone,
  message,
  label = "WhatsApp",
  tone = "solid",
}: {
  phone: string | null;
  message: string;
  label?: string;
  tone?: "solid" | "ghost";
}) {
  const className =
    tone === "solid"
      ? "flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white transition active:scale-95"
      : "flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-emerald-700 transition active:scale-95";

  return (
    <a className={className} href={whatsappLink(phone, message)} rel="noreferrer" target="_blank">
      <ArrowUpRight className="size-3.5" />
      {label}
    </a>
  );
}
