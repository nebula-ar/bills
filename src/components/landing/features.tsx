"use client";

import { motion } from "framer-motion";
import { Calculator, CalendarCheck, Building2, TrendingUp } from "lucide-react";

const features = [
  {
    icon: <CalendarCheck className="w-6 h-6 text-blue-600" />,
    title: "Reservas 24/7 y Cero Ausencias",
    description: "Deja que los clientes reserven mientras duermes. Cobra señas por adelantado y elimina el costo de las sillas vacías.",
  },
  {
    icon: <Building2 className="w-6 h-6 text-red-600" />,
    title: "Multi-Sucursal",
    description: "Gestiona todas tus sucursales desde una sola cuenta. Compara rendimiento entre locales y asigna barberos por sede.",
  },
  {
    icon: <Calculator className="w-6 h-6 text-blue-600" />,
    title: "Pagos sin Dolor",
    description: "Automatiza los números. Calculamos alquiler de sillas y comisiones al instante al final de cada turno.",
  },
  {
    icon: <TrendingUp className="w-6 h-6 text-red-600" />,
    title: "Reportes Ejecutivos",
    description: "Deja de adivinar. Mira tus mejores servicios, barberos con mejor rendimiento y tus márgenes de ganancia exactos en un solo toque.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 bg-slate-50 relative border-t border-slate-200 snap-start">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold text-slate-900 mb-6 font-montserrat">
            Todo lo que necesitas. <br />
            <span className="text-slate-500">Nada que sobre.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="group p-8 rounded-2xl bg-white border border-slate-200 hover:border-blue-500 transition-all shadow-sm hover:shadow-[0_8px_30px_rgba(37,99,235,0.12)] hover:-translate-y-1"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-6 border border-blue-100 group-hover:scale-110 transition-transform group-hover:bg-blue-100">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3 font-montserrat">{feature.title}</h3>
              <p className="text-slate-600 leading-relaxed font-medium">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
