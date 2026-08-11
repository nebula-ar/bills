import Link from "next/link";

import { BrandLogo } from "@/lib/brand-logo";

export function Footer() {
  return (
    <footer className="bg-slate-950 px-5 pb-8 pt-14 text-white sm:px-8 lg:px-12">
      <div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-[1fr_auto_auto]">
        <div>
          <Link href="/" className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">
            <BrandLogo variant="white" height={32} className="-rotate-3" />
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-6 text-slate-400">Gestión simple para negocios que quieren trabajar con más claridad.</p>
        </div>
        <div>
          <p className="mb-4 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Producto</p>
          <div className="space-y-2 text-sm font-semibold text-slate-300">
            <Link className="block rounded-lg transition hover:text-[var(--accent-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950" href="/#producto">Funciones</Link>
            <Link className="block rounded-lg transition hover:text-[var(--accent-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950" href="/#rubros">Rubros</Link>
            <Link className="block rounded-lg transition hover:text-[var(--accent-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950" href="/#precios">Precios</Link>
          </div>
        </div>
        <div>
          <p className="mb-4 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Empresa</p>
          <div className="space-y-2 text-sm font-semibold text-slate-300">
            <Link className="block rounded-lg transition hover:text-[var(--accent-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950" href="/about">Sobre Bills</Link>
            <Link className="block rounded-lg transition hover:text-[var(--accent-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950" href="/contact">Contacto</Link>
            <Link className="block rounded-lg transition hover:text-[var(--accent-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950" href="/privacy">Privacidad</Link>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-14 flex max-w-7xl flex-col gap-2 border-t border-slate-800 pt-5 text-xs font-semibold text-slate-400 sm:flex-row sm:justify-between">
        <span>© {new Date().getFullYear()} Bills</span>
        <span>Hecho para negocios de Argentina</span>
      </div>
    </footer>
  );
}
