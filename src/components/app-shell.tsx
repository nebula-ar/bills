import Link from "next/link";
import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl";
  showBottomNav?: boolean;
};

const shellMaxWidth: Record<NonNullable<AppShellProps["maxWidth"]>, string> = {
  sm: "max-w-xl",
  md: "max-w-3xl",
  lg: "max-w-5xl",
  xl: "max-w-6xl",
};

export function AppShell({ children, maxWidth = "md", showBottomNav = true }: AppShellProps) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 pb-28 pt-5 text-slate-950 sm:px-6 sm:py-10">
      <section className={`mx-auto flex w-full ${shellMaxWidth[maxWidth]} flex-col gap-6`}>
        {children}
      </section>
      {showBottomNav ? <BottomNav /> : null}
    </main>
  );
}

type PageHeaderProps = {
  title: string;
  eyebrow?: string;
  description?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ actions, description, eyebrow = "Barber Bills", title }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-600">{eyebrow}</p>
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

export function BottomNav() {
  const items = [
    { href: "/", label: "Inicio" },
    { href: "/barber", label: "Terminal" },
    { href: "/sales", label: "Ventas" },
    { href: "/reports", label: "Reportes" },
    { href: "/services", label: "Servicios" },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-2 py-2 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden">
      <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
        {items.map((item) => (
          <Link
            className="rounded-2xl px-2 py-2 text-center text-[0.7rem] font-bold text-slate-500 hover:bg-blue-50 hover:text-blue-700"
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
