import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MessageCircle, Phone } from "lucide-react";

import { Footer } from "@/components/landing/footer";
import { Navbar } from "@/components/landing/Navbar";

export const metadata: Metadata = {
  title: "Contacto — Bills",
  description: "Escribinos por WhatsApp, mail o teléfono. Te ayudamos a poner en marcha Bills en tu negocio.",
};

const faqs = [
  { q: "¿Necesito comprar hardware especial?", a: "No. Bills funciona desde el celular, tablet o computadora que ya tenés. Los lectores y terminales son opcionales." },
  { q: "¿Cuánto tarda en estar funcionando?", a: "Podés elegir tu rubro, crear la sucursal y empezar a cargar ventas en minutos. Después ajustás los módulos a tu forma de trabajar." },
  { q: "¿Dan soporte en español?", a: "Sí, todo el soporte es en español y por WhatsApp." },
  { q: "¿Puedo cambiar de plan más adelante?", a: "Sí, podés subir o bajar de plan sin perder tu historial de ventas, clientes ni reportes." },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-slate-950">
      <Navbar />
      <main className="mx-auto max-w-4xl px-5 pb-24 pt-36 sm:px-8">
        <section className="text-center"><p className="mb-5 text-xs font-black uppercase tracking-[0.18em] text-[var(--primary)]">Contacto</p><h1 className="text-5xl font-black leading-[0.94] tracking-[-0.08em] sm:text-7xl">Hablemos de tu negocio.</h1><p className="mx-auto mt-7 max-w-xl text-lg leading-8 text-slate-600">Contanos qué vendés, cuántas sucursales tenés y qué te está costando más hoy.</p></section>
        <section className="mt-12 grid gap-4 sm:grid-cols-3">
          <a href="https://wa.me/5491159804610?text=Hola%2C%20quiero%20saber%20m%C3%A1s%20sobre%20Bills" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-3 rounded-3xl bg-slate-950 p-6 text-center text-white transition hover:bg-[var(--primary)]"><MessageCircle className="h-6 w-6 text-[var(--accent-brand)]" /><span className="font-black">WhatsApp</span><span className="text-sm text-slate-300">+54 9 11 5980-4610</span></a>
          <a href="tel:+5491159804610" className="flex flex-col items-center gap-3 rounded-3xl border border-slate-300 bg-[var(--card)] p-6 text-center transition hover:border-[var(--primary)]"><Phone className="h-6 w-6 text-[var(--primary)]" /><span className="font-black">Llamanos</span><span className="text-sm text-slate-500">+54 9 11 5980-4610</span></a>
          <a href="mailto:wmatias1009@gmail.com" className="flex flex-col items-center gap-3 rounded-3xl border border-slate-300 bg-[var(--card)] p-6 text-center transition hover:border-[var(--primary)]"><Mail className="h-6 w-6 text-[var(--primary)]" /><span className="font-black">Escribinos</span><span className="break-all text-sm text-slate-500">wmatias1009@gmail.com</span></a>
        </section>
        <section className="mt-20"><h2 className="text-center text-3xl font-black tracking-[-0.06em]">Preguntas frecuentes</h2><div className="mt-8 space-y-2">{faqs.map((faq) => <div key={faq.q} className="border-b border-slate-300 py-5"><h3 className="font-black">{faq.q}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{faq.a}</p></div>)}</div><p className="mt-10 text-center text-sm text-slate-500">¿Ya te decidiste? <Link href="/register" className="font-black text-[var(--primary)]">Creá tu cuenta gratis</Link>.</p></section>
      </main>
      <Footer />
    </div>
  );
}
