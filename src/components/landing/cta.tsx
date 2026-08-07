import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function CTASection() {
  return (
    <section id="cta" className="relative overflow-hidden border-t border-slate-200 bg-bills-lime py-24 text-slate-950 lg:py-32">
      <div className="pointer-events-none absolute -right-20 -top-24 size-80 rounded-full border-[42px] border-bills-blue/15" aria-hidden="true" />
      <div data-motion="reveal" className="relative mx-auto flex max-w-7xl flex-col justify-between gap-10 px-5 sm:px-8 md:flex-row md:items-end lg:px-12">
        <div>
          <p className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-[var(--primary)]">Menos administración</p>
          <h2 className="max-w-3xl text-5xl font-black leading-[0.92] tracking-[-0.08em] sm:text-6xl lg:text-7xl">
            Tu negocio tiene mucho para hacer.
            <br />
            <span className="text-[var(--primary)]">La planilla no.</span>
          </h2>
        </div>
        <div className="max-w-xs text-sm font-semibold leading-6 text-slate-700">
          Probá Bills gratis y armá tu primera sucursal en minutos.
          <Link href="/register" className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[var(--primary)] active:scale-95">
            Crear mi cuenta <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
