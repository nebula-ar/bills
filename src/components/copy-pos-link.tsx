"use client";

import { Check, Link2 } from "lucide-react";
import { useState } from "react";

async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Cae al fallback (por ej. HTTP sin contexto seguro).
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

export function CopyPosLink({ branchId }: { branchId: string }) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  async function handleCopy() {
    const full = `${window.location.origin}/barber?branch=${branchId}`;
    setUrl(full);
    const ok = await copyText(full);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1900);
    }
  }

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <button
        className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition active:scale-[0.99] ${
          copied ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"
        }`}
        onClick={handleCopy}
        type="button"
      >
        {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
        {copied ? "¡Link copiado!" : "Copiar link para barberos"}
      </button>
      {url ? (
        <p className="mt-2 select-all break-all rounded-xl bg-slate-50 px-3 py-2 text-center text-[0.7rem] font-semibold text-slate-500">
          {url}
        </p>
      ) : null}
    </div>
  );
}
