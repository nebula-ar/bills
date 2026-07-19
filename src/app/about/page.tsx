import type { Metadata } from "next";
import Link from "next/link";
import { Scissors, Ban, Calculator, Building2 } from "lucide-react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/footer";
import { MagneticButton } from "@/components/landing/MagneticButton";

export const metadata: Metadata = {
  title: "Sobre Barber Bills — Software de gestión para barberías",
  description:
    "Barber Bills es el sistema de gestión para barberías y peluquerías que reemplaza el Excel: turnos, cobro en la silla, comisiones automáticas y reportes, sin comisión sobre tus ventas.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Navbar />

      <main className="pt-32 pb-24">
        <section className="max-w-3xl mx-auto px-6">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-blue-600 mb-4">
            Sobre Barber Bills
          </p>
          <h1 className="text-4xl lg:text-5xl font-bold font-montserrat mb-6 leading-tight">
            El sistema de gestión para barberías que reemplaza el Excel, no que lo copia.
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed mb-6">
            La mayoría de las barberías y peluquerías en Argentina todavía cierran el día a mano:
            un cuaderno para las ventas, una calculadora para las comisiones y una planilla de Excel
            que nadie termina de actualizar. Barber Bills existe para sacar esas tres cosas del medio.
          </p>
          <p className="text-lg text-slate-600 leading-relaxed">
            Es un sistema de gestión pensado específicamente para barberías: agenda de turnos,
            cobro en la silla desde el celular, cálculo automático de comisiones por barbero y
            reportes ejecutivos por sucursal. Todo en un solo lugar, para que el dueño deje de
            administrar números y el barbero deje de perder tiempo haciendo cuentas.
          </p>
        </section>

        <section className="max-w-3xl mx-auto px-6 mt-16">
          <h2 className="text-2xl lg:text-3xl font-bold font-montserrat mb-8">
            Por qué existe Barber Bills
          </h2>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-white border border-slate-200">
              <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center mb-4">
                <Ban className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="font-bold text-lg mb-2 font-montserrat">Sin comisión sobre tus ventas</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Muchas plataformas de turnos cobran un porcentaje por cada cliente o cada cobro.
                A medida que tu barbería crece, esa comisión crece con vos. Barber Bills cobra una
                cuota fija: lo que factures es tuyo.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-white border border-slate-200">
              <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
                <Calculator className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-bold text-lg mb-2 font-montserrat">Comisiones sin discusión</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Cada venta calcula automáticamente qué le corresponde al barbero y qué a la casa.
                Se acabaron las diferencias de fin de mes por un corte que nadie anotó.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-white border border-slate-200">
              <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-bold text-lg mb-2 font-montserrat">Pensado para varias sucursales</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Si tenés más de un local, Barber Bills te muestra qué sucursal rinde más, qué
                barbero factura más y dónde poner el foco, sin cruzar planillas a mano.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-white border border-slate-200">
              <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center mb-4">
                <Scissors className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="font-bold text-lg mb-2 font-montserrat">Hecho para barberías, no adaptado</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                No es un sistema genérico de turnos con el logo cambiado. Está armado alrededor de
                cómo trabaja realmente una barbería: silla, terminal, comisión, cierre de caja.
              </p>
            </div>
          </div>
        </section>

        <section className="max-w-3xl mx-auto px-6 mt-16 text-center">
          <h2 className="text-2xl lg:text-3xl font-bold font-montserrat mb-4">
            ¿Listo para dejar el Excel?
          </h2>
          <p className="text-slate-600 mb-8">
            Probá Barber Bills gratis y armá tu primera sucursal en minutos.
          </p>
          <div className="flex justify-center">
            <MagneticButton href="/register" className="px-8 py-4" roundedClass="rounded-xl">
              Prueba Gratis
            </MagneticButton>
          </div>
          <p className="text-sm text-slate-500 mt-6">
            ¿Preferís hablar primero? <Link href="/contact" className="font-bold text-blue-600 hover:underline">Contactanos</Link>.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  );
}
