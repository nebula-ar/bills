import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/footer";

export const metadata: Metadata = {
  title: "Contacto — Bills",
  description:
    "Escribinos por WhatsApp, mail o teléfono. Te ayudamos a poner en marcha Bills en tu negocio.",
};

const faqs = [
  {
    q: "¿Necesito comprar algún hardware especial?",
    a: "No. Bills funciona desde el celular o la tablet que ya tenés. No hace falta un lector de tarjetas ni una caja registradora nueva.",
  },
  {
    q: "¿Cuánto tarda en estar funcionando?",
    a: "La mayoría de las negocios cargan sus sucursales, servicios y empleados, y empiezan a vender el mismo día. Si tenés varias sucursales, te ayudamos con la carga inicial.",
  },
  {
    q: "¿Dan soporte en español?",
    a: "Sí, todo el soporte es en español y por WhatsApp, para que no tengas que esperar un mail para resolver algo urgente.",
  },
  {
    q: "¿Puedo cambiar de plan más adelante?",
    a: "Sí, podés subir o bajar de plan cuando quieras desde tu cuenta, sin perder tu historial de ventas ni comisiones.",
  },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Navbar />

      <main className="pt-32 pb-24">
        <section className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-blue-600 mb-4">
            Contacto
          </p>
          <h1 className="text-4xl lg:text-5xl font-bold font-montserrat mb-6 leading-tight">
            Hablemos de tu negocio
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed max-w-xl mx-auto">
            Contanos cuántas sucursales tenés y qué te está costando más hoy. Te respondemos
            directo, sin formularios eternos.
          </p>
        </section>

        <section className="max-w-3xl mx-auto px-6 mt-12">
          <div className="grid sm:grid-cols-3 gap-4">
            <a
              href="https://wa.me/5491159804610?text=Hola%2C%20quiero%20saber%20m%C3%A1s%20sobre%20Staff%20Bills"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-blue-600 text-white shadow-[0_12px_24px_-8px_rgba(37,99,235,0.5)] hover:bg-blue-700 transition-colors"
            >
              <MessageCircle className="w-6 h-6" />
              <span className="font-bold">WhatsApp</span>
              <span className="text-sm text-blue-100">+54 9 11 5980-4610</span>
            </a>
            <a
              href="tel:+5491159804610"
              className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 transition-colors"
            >
              <Phone className="w-6 h-6 text-blue-600" />
              <span className="font-bold text-slate-900">Llamanos</span>
              <span className="text-sm text-slate-500">+54 9 11 5980-4610</span>
            </a>
            <a
              href="mailto:wmatias1009@gmail.com"
              className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 transition-colors"
            >
              <Mail className="w-6 h-6 text-blue-600" />
              <span className="font-bold text-slate-900">Escribinos</span>
              <span className="text-sm text-slate-500 break-all">wmatias1009@gmail.com</span>
            </a>
          </div>
        </section>

        <section className="max-w-3xl mx-auto px-6 mt-20">
          <h2 className="text-2xl lg:text-3xl font-bold font-montserrat mb-8 text-center">
            Preguntas frecuentes
          </h2>
          <div className="flex flex-col gap-4">
            {faqs.map((faq) => (
              <div key={faq.q} className="p-6 rounded-2xl bg-white border border-slate-200">
                <h3 className="font-bold text-slate-900 mb-2">{faq.q}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-slate-500 mt-10">
            ¿Ya te decidiste? <Link href="/register" className="font-bold text-blue-600 hover:underline">Creá tu cuenta gratis</Link>.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  );
}
