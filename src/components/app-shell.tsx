import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
};

const shellMaxWidth: Record<NonNullable<AppShellProps["maxWidth"]>, string> = {
  sm: "max-w-xl",
  md: "max-w-3xl",
  lg: "max-w-5xl",
  xl: "max-w-6xl",
  // Sin tope: para las pantallas que son una tabla, encajonarlas desperdicia
  // media pantalla mientras las columnas cortan el texto.
  full: "max-w-none",
};

// La barra de navegación inferior es global (se monta en el layout raíz) y flota
// por encima del contenido. El padding inferior tiene que dejar libre su alto más
// el margen que la separa del borde: con menos, el último botón de la pantalla
// queda debajo de la barra y no se puede tocar.
export function AppShell({ children, maxWidth = "md" }: AppShellProps) {
  return (
    <main className="min-h-screen px-4 pb-40 pt-5 text-slate-950 sm:px-6 sm:pb-40 sm:pt-10">
      <section className={`mx-auto flex w-full ${shellMaxWidth[maxWidth]} flex-col gap-6`}>
        {children}
      </section>
    </main>
  );
}

type PageHeaderProps = {
  title: string;
  eyebrow?: string;
  description?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ actions, description, eyebrow = "Bills", title }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
        {description ? <p className="mt-2 text-sm leading-6 text-slate-500 sm:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3 text-sm font-semibold text-slate-600">{actions}</div> : null}
    </header>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <article className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</article>;
}
