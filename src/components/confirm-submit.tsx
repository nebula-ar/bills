"use client";

import { useEffect, useRef, useState } from "react";

// Borrar en dos toques.
//
// Estos botones —eliminar un cliente, borrar un gasto, deshacer una
// transferencia— ejecutaban al primer toque y no hay forma de recuperar lo
// borrado. Anular una venta ya pedía confirmación; el resto no, sin ninguna
// razón.
//
// Es un segundo toque y no un diálogo a propósito: los carteles de "¿estás
// seguro?" se acumulan y la gente aprende a aceptarlos sin leer. Acá el propio
// botón cambia de cara y se arrepiente solo a los pocos segundos.

const REVERT_MS = 4000;

export function ConfirmSubmit({
  children,
  confirmLabel = "Sí, borrar",
  className = "",
}: {
  children: React.ReactNode;
  confirmLabel?: string;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  function arm() {
    setArmed(true);
    // Si se distrae, el botón vuelve solo a su estado normal: un botón armado
    // esperando para siempre es una trampa.
    timer.current = window.setTimeout(() => setArmed(false), REVERT_MS);
  }

  if (!armed) {
    return (
      <button
        className={
          className ||
          "inline-flex min-h-11 items-center justify-center rounded-xl border border-rose-200 bg-white px-3 py-2.5 text-xs font-black text-rose-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-95"
        }
        onClick={arm}
        type="button"
      >
        {children}
      </button>
    );
  }

  return (
    <button
      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-rose-600 px-3 py-2.5 text-xs font-black text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-95"
      type="submit"
    >
      {confirmLabel}
    </button>
  );
}
