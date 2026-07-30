import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CurvedDivider } from "./CurvedDivider";

export function CTASection() {
  return (
    <section id="cta" className="pt-24 pb-32 lg:pb-48 relative overflow-hidden bg-white border-t border-slate-200 snap-start">
      <div className="absolute inset-0 bg-blue-50/50" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-blue-400/20 blur-[100px] rounded-full pointer-events-none" />
      
      <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
        <h2 className="text-4xl lg:text-6xl font-bold text-slate-900 mb-6 font-montserrat tracking-tight">
          ¿Listo para subir de nivel?
        </h2>
        <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
          Únete a las negocios modernas que dejaron los Excel y empezaron a crecer su negocio de verdad.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/register"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 hover:shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all text-lg"
          >
            Crea tu Cuenta
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center px-8 py-4 bg-white text-blue-700 rounded-xl font-bold hover:bg-blue-50 border-2 border-blue-100 hover:border-blue-200 transition-colors text-lg shadow-sm"
          >
            Habla con Ventas
          </Link>
        </div>
      </div>
      
      <CurvedDivider />
    </section>
  );
}
