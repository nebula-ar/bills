"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";

const testimonials = [
  {
    quote: "Antes perdíamos 2 horas al día haciendo cuentas. Ahora corto el pelo, toco la pantalla, y la app separa mi comisión de la del dueño automáticamente.",
    author: "Nico Fernández",
    role: "Barbero",
    shop: "El Rulo",
  },
  {
    quote: "Los clientes reservan de madrugada mientras yo duermo. El sistema les cobra seña, y si no vienen, no pierdo plata. Así de simple.",
    author: "Matías Toledo",
    role: "Dueño",
    shop: "Barbería Sur",
  },
  {
    quote: "La mejor inversión. Con el reporte diario sé exactamente qué sucursal rinde más y qué barbero metió más cortes. Dejamos el Excel para siempre.",
    author: "Fede González",
    role: "Manager",
    shop: "La Navaja",
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-24 bg-[#131314]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold text-white mb-6 font-montserrat">
            Trusted by the <span className="text-[#d4af37]">best shops.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="p-8 rounded-2xl bg-[#12121A] border border-[#353436] flex flex-col justify-between"
            >
              <div>
                <div className="flex gap-1 mb-6">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-4 h-4 fill-[#d4af37] text-[#d4af37]" />
                  ))}
                </div>
                <p className="text-gray-300 leading-relaxed mb-8 italic">
                  &quot;{t.quote}&quot;
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-[#d4af37]/20 border border-[#d4af37]/30 flex items-center justify-center font-bold text-[#d4af37]">
                  {t.author.charAt(0)}
                </div>
                <div>
                  <p className="text-white font-medium">{t.author}</p>
                  <p className="text-sm text-gray-500">{t.role} @ {t.shop}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
