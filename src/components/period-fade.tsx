"use client";

import type { ReactNode } from "react";

// Envuelve el contenido que depende de un período (día, mes, sucursal, rango).
// Cuando `period` cambia, React re-monta el div (el `key` cambia) y la entrada
// con fade+slide se reproduce de nuevo: es la transición sutil que evita el
// "corte seco" al cambiar de chip. Con prefers-reduced-motion el CSS global
// anula la animación.
export function PeriodFade({ period, children }: { period: string; children: ReactNode }) {
  return (
    <div
      className="duration-500 animate-in fade-in slide-in-from-bottom-2"
      key={period}
      style={{ animationFillMode: "backwards" }}
    >
      {children}
    </div>
  );
}
