"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Individual",
    price: "9.900",
    period: "/mes",
    description: "Para el barbero o la barbería de un solo puesto que quiere dejar el cuaderno.",
    features: [
      "1 sucursal, 1 terminal de cobro",
      "Barberos ilimitados con PIN propio",
      "Comisiones calculadas automáticamente",
      "Apertura y cierre de caja diario",
      "Reportes básicos de ventas y gastos",
      "0% de comisión sobre tus ventas",
    ],
    cta: "Prueba Gratis",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "18.900",
    period: "/mes",
    description: "Para barberías con varios puestos de cobro trabajando al mismo tiempo.",
    features: [
      "Todo lo de Individual",
      "Terminales de cobro ilimitadas",
      "Gestión avanzada de gastos y caja",
      "Reportes ejecutivos: ticket promedio y ranking de barberos",
      "Links de cobro por terminal para tu equipo",
      "0% de comisión sobre tus ventas",
    ],
    cta: "Prueba Gratis",
    highlighted: true,
  },
  {
    name: "Multi-Sucursal",
    price: "34.900",
    period: "/mes",
    description: "Para cadenas de barberías que gestionan varias sedes desde un solo lugar.",
    features: [
      "Todo lo de Pro",
      "Sucursales ilimitadas",
      "Comparación de rendimiento entre sucursales",
      "Asignación de barberos y precios por sede",
      "Soporte prioritario",
      "0% de comisión sobre tus ventas",
    ],
    cta: "Hablar con Ventas",
    highlighted: false,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="py-24 bg-white relative border-t border-slate-200 snap-start">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold text-slate-900 mb-6 font-montserrat">
            Precio simple. <span className="text-slate-500">Sin sorpresas.</span>
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            A diferencia de otras plataformas, no cobramos comisión sobre tus ventas. Pagás una cuota fija y el resto es tuyo.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 items-start">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`relative flex flex-col p-8 rounded-2xl border transition-all ${
                plan.highlighted
                  ? "bg-slate-900 border-slate-900 shadow-[0_20px_50px_-15px_rgba(37,99,235,0.4)] md:-translate-y-3"
                  : "bg-white border-slate-200 shadow-sm hover:border-blue-500"
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-full tracking-tight shadow-md">
                  Más elegido
                </span>
              )}

              <h3 className={`text-xl font-bold mb-2 font-montserrat ${plan.highlighted ? "text-white" : "text-slate-900"}`}>
                {plan.name}
              </h3>
              <p className={`text-sm mb-6 leading-relaxed ${plan.highlighted ? "text-slate-300" : "text-slate-500"}`}>
                {plan.description}
              </p>

              <div className="mb-8">
                <span className={`text-4xl font-black tracking-tight ${plan.highlighted ? "text-white" : "text-slate-900"}`}>
                  $ {plan.price}
                </span>
                <span className={`text-sm font-medium ${plan.highlighted ? "text-slate-400" : "text-slate-500"}`}>
                  {" "}ARS {plan.period}
                </span>
              </div>

              <ul className="flex flex-col gap-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm">
                    <Check className={`w-4 h-4 mt-0.5 shrink-0 ${plan.highlighted ? "text-blue-400" : "text-blue-600"}`} />
                    <span className={plan.highlighted ? "text-slate-200" : "text-slate-600"}>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.cta === "Hablar con Ventas" ? "/contact" : "/register"}
                className={`inline-flex items-center justify-center px-6 py-3.5 rounded-xl font-bold text-sm transition-colors ${
                  plan.highlighted
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-slate-50 text-slate-900 border-2 border-slate-200 hover:border-slate-300"
                }`}
              >
                {plan.cta}
              </Link>
            </motion.div>
          ))}
        </div>

        <p className="text-center text-sm text-slate-500 mt-10">
          Todos los planes incluyen 14 días de prueba gratis. Sin tarjeta de crédito.
        </p>
      </div>
    </section>
  );
}
