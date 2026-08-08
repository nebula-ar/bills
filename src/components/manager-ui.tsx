import type { ReactNode } from "react";

// Piezas compartidas por las pantallas de gestión (stock, proveedores, promos,
// clientes, módulos). Existen para que todas se vean como el mismo sistema y
// para no repetir el mismo markup cinco veces.
// Nota: este módulo es server. StatTiles (que anima con count-up) vive aparte
// en `stat-tiles.tsx` porque necesita `"use client"`.

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export function formatMoney(value: number) {
  return money.format(value);
}

export type Tone = "neutral" | "positive" | "warning" | "danger" | "info";

const TONE_BADGE: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  positive: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-rose-100 text-rose-800",
  info: "bg-primary/15 text-primary",
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold ${TONE_BADGE[tone]}`}>
      {children}
    </span>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black tracking-tight text-slate-950">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    // Entrada suave: un estado sin datos se siente intencional, no roto.
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center animate-in fade-in slide-in-from-bottom-2 duration-500">
      <p className="text-sm font-bold text-slate-700">{title}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

// Campo de formulario con su etiqueta. Los formularios de gestión son todos
// `<form action={serverAction}>`, así que no necesitan estado en el cliente.
export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
      {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15";

export const selectClass = `${inputClass} appearance-none`;

// Los botones compartidos cumplen WCAG 2.5.5: área de toque ≥44px sin forzar
// el alto en pantallas chicas. min-h-11 (44px) + padding generoso; el texto
// chico de Ghost/Danger se mantiene, pero el target es tocable con el pulgar.
export function PrimaryButton({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-95 ${className}`}
      type="submit"
    >
      {children}
    </button>
  );
}

export function GhostButton({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-95 ${className}`}
      type="submit"
    >
      {children}
    </button>
  );
}

export function DangerButton({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-95 ${className}`}
      type="submit"
    >
      {children}
    </button>
  );
}

// Contenedor de tabla que scrollea solo en horizontal: en el celular las
// pantallas de gestión tienen más columnas de las que entran.
export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="-mx-5 overflow-x-auto px-5">{children}</div>;
}
