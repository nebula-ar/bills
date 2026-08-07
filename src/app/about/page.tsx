import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Boxes, CircleDollarSign, LayoutDashboard, Store } from "lucide-react";

import { Footer } from "@/components/landing/footer";
import { Navbar } from "@/components/landing/Navbar";

export const metadata: Metadata = {
  title: "Sobre Bills — Gestión para negocios",
  description: "Bills es el sistema de gestión adaptable para negocios de productos y servicios en Argentina.",
};

const pillars = [
  { icon: LayoutDashboard, title: "Un solo lugar", text: "Ventas, caja, stock, clientes y reportes conectados para no duplicar trabajo." },
  { icon: Boxes, title: "Solo lo que necesitás", text: "Prendés los módulos que aplican a tu negocio y ocultás lo que sobra." },
  { icon: CircleDollarSign, title: "Sin comisión", text: "Pagás una cuota fija. Lo que factura tu negocio sigue siendo tuyo." },
  { icon: Store, title: "Hecho para Argentina", text: "Pesos, sucursales, proveedores, fiado y exportación para tu contador." },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-slate-950">
      <Navbar />
      <main className="mx-auto max-w-7xl px-5 pb-24 pt-36 sm:px-8 lg:px-12">
        <section className="max-w-4xl">
          <p className="mb-5 text-xs font-black uppercase tracking-[0.18em] text-[var(--primary)]">Sobre Bills</p>
          <h1 className="text-5xl font-black leading-[0.94] tracking-[-0.08em] sm:text-7xl">El sistema de gestión que se adapta a tu negocio.</h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 text-slate-600">Un kiosco, una tienda, una barbería y un estudio no trabajan igual. Pero todos necesitan saber qué vendieron, qué salió y qué pueden decidir después.</p>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">Bills comparte un core para todos y adapta el vocabulario, los módulos y la configuración inicial a cada rubro. Así empezás con algo que tiene sentido, no con una app vacía.</p>
        </section>
        <section className="mt-20 grid gap-4 sm:grid-cols-2">
          {pillars.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-3xl border border-slate-300 bg-[var(--card)] p-7"><Icon className="h-6 w-6 text-[var(--primary)]" aria-hidden="true" /><h2 className="mt-8 text-2xl font-black tracking-[-0.05em]">{title}</h2><p className="mt-3 text-sm leading-6 text-slate-600">{text}</p></article>)}
        </section>
        <section className="mt-20 flex flex-col justify-between gap-8 border-t border-slate-300 pt-8 md:flex-row md:items-end"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--primary)]">¿Listo para ordenar?</p><h2 className="mt-4 text-4xl font-black tracking-[-0.07em] sm:text-5xl">Empezá con el negocio que ya tenés.</h2></div><Link href="/register" className="inline-flex min-h-12 items-center gap-2 self-start rounded-xl bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-[var(--primary)] md:self-auto">Probá Bills gratis <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link></section>
      </main>
      <Footer />
    </div>
  );
}
