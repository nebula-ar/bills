"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";

type ActionResult = { ok: boolean; message: string };

type ConfirmDeleteButtonProps = {
  /** Server action que borra. Recibe los campos como FormData. */
  action: (formData: FormData) => Promise<ActionResult>;
  /** Campos ocultos del formulario (id del registro, día, sucursal…). */
  fields: Record<string, string>;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  /** Mensaje del toast de éxito, después de refrescar el árbol. */
  successMessage: string;
  className?: string;
  children?: ReactNode;
  ariaLabel?: string;
};

// Borrar con confirmación en un modal (NEBU-36).
//
// Reemplaza al ConfirmSubmit de dos toques en las acciones destructivas: el
// modal explica las consecuencias ANTES de confirmar, muestra un spinner
// mientras corre la acción y, al terminar bien, refresca el árbol actual para
// que el registro desaparezca sin recargar la página. Si la acción falla, el
// toast muestra el mensaje real y el diálogo queda abierto para reintentar.
//
// El estilo por defecto es el mismo del ConfirmSubmit desarmado: botón de
// borde rosado que no parece un botón principal hasta que se arma.
export function ConfirmDeleteButton({
  action,
  fields,
  title,
  description,
  confirmLabel = "Sí, borrar",
  successMessage,
  className,
  children,
  ariaLabel,
}: ConfirmDeleteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        aria-label={ariaLabel}
        className={
          className ??
          "inline-flex min-h-11 items-center justify-center rounded-xl border border-rose-200 bg-white px-3 py-2.5 text-xs font-black text-rose-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-95"
        }
        onClick={() => setOpen(true)}
        type="button"
      >
        {children ?? confirmLabel}
      </button>
      <ConfirmDialog
        cancelLabel="Cancelar"
        confirmLabel={confirmLabel}
        description={description}
        onConfirm={async () => {
          const formData = new FormData();
          for (const [key, value] of Object.entries(fields)) formData.set(key, value);
          const result = await action(formData);
          if (!result.ok) throw new Error(result.message);
        }}
        onOpenChange={setOpen}
        onSuccess={() => {
          toast.success(successMessage);
          router.refresh();
        }}
        open={open}
        title={title}
      />
    </>
  );
}
