"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { faqs } from "./faq-data";

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-24 bg-slate-50 relative border-t border-slate-200 snap-start">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-5xl font-bold text-slate-900 mb-4 font-montserrat">
            Preguntas frecuentes
          </h2>
          <p className="text-slate-600">
            Todo lo que necesitás saber sobre el software para barberías de Barber Bills.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={faq.q}
                className={`rounded-2xl border transition-colors ${isOpen ? "border-blue-200 bg-white" : "border-slate-200 bg-white"}`}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 p-5 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="font-bold text-slate-900">{faq.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${isOpen ? "rotate-180 text-blue-600" : ""}`}
                  />
                </button>
                {isOpen && (
                  <p className="px-5 pb-5 text-slate-600 leading-relaxed text-[15px]">{faq.a}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
