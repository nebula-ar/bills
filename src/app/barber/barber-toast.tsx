"use client";

import { CheckCircle2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

// Debe coincidir con FLASH_COOKIE de "@/lib/barber-flash" (no lo importamos para no
// arrastrar next/headers al bundle del cliente).
const FLASH_COOKIE = "barber_flash";

// Notificación efímera de la terminal: entra desde arriba, se auto-oculta a los
// ~3,4 s y borra la cookie del flash (desde el cliente) para que no reaparezca al refrescar.
export function BarberToast({ status, message }: { status: "success" | "error"; message: string }) {
  const [phase, setPhase] = useState<"in" | "out" | "gone">("in");

  useEffect(() => {
    document.cookie = `${FLASH_COOKIE}=; Max-Age=0; path=/`;
    const leave = window.setTimeout(() => setPhase("out"), 3200);
    const gone = window.setTimeout(() => setPhase("gone"), 3600);
    return () => {
      window.clearTimeout(leave);
      window.clearTimeout(gone);
    };
  }, []);

  if (phase === "gone") {
    return null;
  }

  const success = status === "success";
  const Icon = success ? CheckCircle2 : TriangleAlert;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div
        className={`flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-black shadow-lg ring-1 transition-all duration-300 ${
          success ? "bg-emerald-600 text-white ring-emerald-700/20" : "bg-rose-600 text-white ring-rose-700/20"
        } ${phase === "out" ? "-translate-y-3 opacity-0" : "translate-y-0 opacity-100"}`}
        role="status"
      >
        <Icon aria-hidden="true" className="size-5 shrink-0" />
        <span>{message}</span>
      </div>
    </div>
  );
}
