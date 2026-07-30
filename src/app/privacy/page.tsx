import type { Metadata } from "next";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/footer";

export const metadata: Metadata = {
  title: "Política de Privacidad — Bills",
  description: "Cómo Bills recopila, usa y protege los datos de tu cuenta y tu negocio.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Navbar />

      <main className="pt-32 pb-24">
        <section className="max-w-3xl mx-auto px-6">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-blue-600 mb-4">Legal</p>
          <h1 className="text-4xl font-bold font-montserrat mb-4">Política de Privacidad</h1>
          <p className="text-sm text-slate-500 mb-12">Última actualización: julio de 2026.</p>

          <div className="flex flex-col gap-10 text-slate-600 leading-relaxed">
            <div>
              <h2 className="text-xl font-bold font-montserrat text-slate-900 mb-3">1. Responsable</h2>
              <p>
                Bills es el sistema de gestión operado para administrar negocios y
                peluquerías. Ante cualquier consulta sobre esta política o tus datos, podés
                escribirnos a{" "}
                <a href="mailto:wmatias1009@gmail.com" className="text-blue-600 font-medium hover:underline">
                  wmatias1009@gmail.com
                </a>{" "}
                o por WhatsApp al{" "}
                <a href="https://wa.me/5491159804610" className="text-blue-600 font-medium hover:underline">
                  +54 9 11 5980-4610
                </a>
                .
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold font-montserrat text-slate-900 mb-3">2. Qué datos recopilamos</h2>
              <ul className="list-disc pl-5 flex flex-col gap-2">
                <li>
                  <strong className="text-slate-900">Datos de tu negocio:</strong> nombre del
                  negocio, sucursales y direcciones que cargás en tu cuenta.
                </li>
                <li>
                  <strong className="text-slate-900">Datos de cuentas de usuario:</strong> nombre,
                  email y usuario de cada persona que administrás dentro de tu negocio (dueños,
                  encargados y empleados). Las contraseñas y PIN se guardan siempre cifrados, nunca
                  en texto plano.
                </li>
                <li>
                  <strong className="text-slate-900">Datos operativos:</strong> ventas, servicios,
                  medios de pago declarados, gastos y cierres de caja que registrás para llevar la
                  contabilidad de tu negocio.
                </li>
              </ul>
              <p className="mt-3">
                No pedimos ni almacenamos datos de tarjetas de crédito o débito de tus clientes:
                Bills solo registra qué medio de pago usaron, no procesa el cobro en sí.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold font-montserrat text-slate-900 mb-3">3. Para qué usamos tus datos</h2>
              <p>
                Usamos esta información exclusivamente para operar tu cuenta: mostrarte tus
                reportes, calcular comisiones, mantener tu sesión iniciada y darte soporte cuando
                nos escribís. No vendemos ni compartimos tus datos con terceros para fines
                publicitarios.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold font-montserrat text-slate-900 mb-3">4. Cookies</h2>
              <p>
                Usamos únicamente cookies técnicas necesarias para mantener tu sesión iniciada.
                Bills no utiliza cookies de rastreo publicitario ni comparte datos de
                navegación con redes de publicidad.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold font-montserrat text-slate-900 mb-3">5. Tus derechos</h2>
              <p>
                Podés pedirnos en cualquier momento acceder, corregir o eliminar los datos de tu
                cuenta y tu negocio. Para ejercer estos derechos, escribinos a{" "}
                <a href="mailto:wmatias1009@gmail.com" className="text-blue-600 font-medium hover:underline">
                  wmatias1009@gmail.com
                </a>
                .
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold font-montserrat text-slate-900 mb-3">6. Cambios en esta política</h2>
              <p>
                Si actualizamos esta política, vamos a reflejar la fecha de la nueva versión al
                inicio de esta página.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
