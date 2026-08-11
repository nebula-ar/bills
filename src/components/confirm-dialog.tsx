"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertDialog as AlertDialogPrimitive } from "radix-ui";
import { toast } from "sonner";
import { Check, Loader2, TriangleAlert } from "@/components/icons";

// Diálogo de confirmación para acciones destructivas / irreversibles (NEBU-33).
//
// Un solo nivel desde NEBU-36: los borrados (turno, cliente, presupuesto,
// promoción, transferencia, terminal) también pasan por acá vía
// ConfirmDeleteButton — el modal explica las consecuencias ANTES de confirmar,
// muestra un spinner mientras corre la acción y refresca el árbol al terminar.
// Cerrar sesión sigue siendo el caso P0 original.
//
// Estados: idle → loading (spinner en el botón primario, ambos deshabilitados,
// sin doble envío) → éxito (check breve) → cierre/redirect. Si la acción falla,
// se muestra un toast (sonner) y el diálogo permanece abierto para reintentar.
//
// a11y: role="alertdialog" + aria-modal + focus trap + Esc cancela + foco vuelve
// al trigger al cerrar (todo lo da radix AlertDialog). z-index por encima de la
// nav flotante (z-20) y del bottom-sheet (z-60).

const SUCCESS_MS = 700;

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Qué pasa al confirmar. Se muestra antes de que el usuario se decida. */
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Acción a ejecutar al confirmar. Si lanza un error, se muestra el toast y el diálogo queda abierto. */
  onConfirm: () => Promise<void>;
  /** Se llama después del check de éxito, justo antes del cierre (ej. redirect). */
  onSuccess?: () => void;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  onSuccess,
}: ConfirmDialogProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const successTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (successTimer.current) window.clearTimeout(successTimer.current);
    },
    [],
  );

  function handleOpenChange(next: boolean) {
    // Mientras está procesando, la única salida es que la acción termine.
    if (!next && status === "loading") return;
    // Cada apertura arranca en estado base (idle).
    if (next) setStatus("idle");
    onOpenChange(next);
  }

  async function handleConfirm() {
    if (status !== "idle") return;
    setStatus("loading");
    try {
      await onConfirm();
      setStatus("success");
      successTimer.current = window.setTimeout(() => {
        onOpenChange(false);
        onSuccess?.();
      }, SUCCESS_MS);
    } catch (error) {
      // El diálogo queda abierto para reintentar; el error se ve en el toast.
      // Si la acción tiró un Error con mensaje (p. ej. un delete que devolvió
      // ok:false), se muestra ese mensaje real en vez de uno genérico.
      setStatus("idle");
      toast.error(error instanceof Error ? error.message : "No se pudo completar la acción. Intentá de nuevo.");
    }
  }

  const busy = status !== "idle";

  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-slate-950/50 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out" />
        <AlertDialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-[70] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_80px_-12px_rgba(15,23,42,0.35)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95"
          onEscapeKeyDown={(event) => {
            if (status === "loading") event.preventDefault();
          }}
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3.5">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-600">
                <TriangleAlert aria-hidden="true" className="size-6" />
              </span>
              <div className="min-w-0">
                <AlertDialogPrimitive.Title className="text-lg font-black tracking-tight text-slate-950">
                  {title}
                </AlertDialogPrimitive.Title>
                <AlertDialogPrimitive.Description className="mt-1.5 text-sm leading-6 text-slate-500">
                  {description}
                </AlertDialogPrimitive.Description>
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2.5 pt-1 sm:flex-row sm:justify-end">
              <button
                aria-label={cancelLabel}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50"
                disabled={busy}
                onClick={() => onOpenChange(false)}
                type="button"
              >
                {cancelLabel}
              </button>
              <button
                aria-label={confirmLabel}
                className="inline-flex h-11 min-w-32 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-black text-white shadow-sm shadow-rose-600/25 transition hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2 disabled:opacity-70 active:scale-[0.98]"
                disabled={busy}
                onClick={() => void handleConfirm()}
                type="button"
              >
                {status === "loading" ? (
                  <>
                    <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                    Procesando…
                  </>
                ) : status === "success" ? (
                  <>
                    <Check aria-hidden="true" className="size-4" />
                    Listo
                  </>
                ) : (
                  confirmLabel
                )}
              </button>
            </div>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
