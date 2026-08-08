"use client";

import { AnimatedMoney, AnimatedNumber } from "@/components/animated-number";
import type { Tone } from "@/components/manager-ui";

const TONE_TILE: Record<Tone, string> = {
  neutral: "bg-white text-slate-950",
  positive: "bg-emerald-50 text-emerald-900",
  warning: "bg-amber-50 text-amber-900",
  danger: "bg-rose-50 text-rose-900",
  info: "bg-primary/10 text-primary",
};

export type StatTile = {
  label: string;
  // Lo que se muestra por defecto. Si `amount` viene, se ignora y el número
  // se anima con count-up (money = plata, int = conteo).
  value: string;
  hint?: string;
  tone?: Tone;
  /** Monto/valor numérico para animar. */
  amount?: number;
  /** Cómo formatear el número animado. */
  kind?: "money" | "int";
};

// Fila de números grandes que encabeza cada pantalla: lo que el dueño mira
// primero (cuánto debo, cuánto vale mi stock, cuánto me deben). Con `amount`
// el número entra con count-up (igual que el dashboard), así "esto cambió" se
// comunica en todas las pantallas de dinero, no solo en una. Vive en su propio
// client component para no arrastrar el resto de manager-ui al navegador.
export function StatTiles({ tiles }: { tiles: StatTile[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((tile) => (
        <div
          className={`rounded-2xl border border-slate-200 p-4 shadow-sm ${TONE_TILE[tile.tone ?? "neutral"]}`}
          key={tile.label}
        >
          <p className="text-[0.68rem] font-bold uppercase tracking-wider opacity-70">{tile.label}</p>
          <p className="mt-1 text-xl font-black tracking-tight sm:text-2xl">
            {tile.amount !== undefined ? (
              tile.kind === "money" ? (
                <AnimatedMoney value={tile.amount} />
              ) : (
                <AnimatedNumber value={tile.amount} />
              )
            ) : (
              tile.value
            )}
          </p>
          {tile.hint ? <p className="mt-0.5 text-xs opacity-70">{tile.hint}</p> : null}
        </div>
      ))}
    </div>
  );
}
