"use client";

import { useEffect, useRef, useState } from "react";

// Borrar en dos toques.
//
// Desde NEBU-36 los borrados de registros pasan por el ConfirmDialog (modal
// con spinner y refresco del árbol, ver ConfirmDeleteButton). Queda para
// acciones dentro de formularios que ya manejan estado y refresco desde el
// cliente (p. ej. gastos): el propio botón cambia de cara y se arrepiente
// solo a los pocos segundos.

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
