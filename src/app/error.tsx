"use client";

import { RotateCcw } from "@/components/icons";
import { useEffect } from "react";

// Error boundary de la app. Reemplaza la pantalla rota por un mensaje claro con
// opción de reintentar. El detalle técnico va a la consola/observabilidad, no a
// la cara del usuario.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col items-center justify-center bg-[#f6f7fb] px-6 text-center text-slate-950">
      <div className="mb-5 flex size-16 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-950/5">
        <RotateCcw className="size-7 text-slate-400" />
      </div>
      <h1 className="text-xl font-black tracking-tight">Algo salió mal</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        No pudimos cargar esta pantalla. Probá de nuevo; si sigue pasando, avisanos.
      </p>
      <button
        className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm shadow-blue-600/25 transition active:scale-95"
        onClick={reset}
        type="button"
      >
        <RotateCcw className="size-4" />
        Reintentar
      </button>
    </main>
  );
}
