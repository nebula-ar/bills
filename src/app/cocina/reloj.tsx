"use client";

import { useEffect, useState } from "react";

import { nivelDeDemora, textoDeEspera } from "@/modules/tables/kitchen";

/**
 * La tarjeta de un renglón en la cocina, con su reloj corriendo.
 *
 * Vive en el cliente por dos motivos. El de forma: `Date.now()` durante el
 * render del servidor es impuro. El de fondo, que es el que importa: en una
 * cocina un número quieto parece pantalla colgada, y el cocinero necesita ver
 * que el tiempo corre para saber cuál apurar.
 *
 * El color del borde sale del mismo reloj, así que la urgencia se ve sin leer:
 * a un metro de distancia el color llega antes que el número.
 */

const BORDE: Record<string, string> = {
  normal: "border-slate-200 bg-white",
  atencion: "border-amber-300 bg-amber-50",
  urgente: "border-destructive/40 bg-destructive/10",
};

const TEXTO: Record<string, string> = {
  normal: "text-slate-500",
  atencion: "text-amber-600",
  urgente: "text-destructive",
};

export function TarjetaDeCocina({
  children,
  desde,
  prepMinutes,
  titulo,
}: {
  children: React.ReactNode;
  /** Milisegundos: cuándo se mandó a cocina. */
  desde: number;
  prepMinutes: number | null;
  titulo: string;
}) {
  // Arranca en `desde` para que el servidor y el cliente pinten lo mismo en el
  // primer render; el intervalo lo corrige un segundo después.
  const [ahora, setAhora] = useState(desde);

  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000);

    return () => clearInterval(id);
  }, []);

  const minutos = Math.floor((ahora - desde) / 60000);
  const nivel = nivelDeDemora(minutos, prepMinutes);

  return (
    <article className={`rounded-2xl border p-4 ${BORDE[nivel]}`}>
      <div className="flex items-start justify-between gap-2">
        {/* La MESA arriba y grande: es lo que el cocinero canta cuando sale. */}
        <p className="text-base font-black tracking-tight text-slate-950">{titulo}</p>
        <span className={`shrink-0 font-mono text-sm font-bold tabular-nums ${TEXTO[nivel]}`}>
          {textoDeEspera(desde, ahora)}
        </span>
      </div>
      {children}
    </article>
  );
}
