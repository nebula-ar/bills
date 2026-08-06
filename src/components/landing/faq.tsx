"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { landingFaqs } from "./landing-content";

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="border-t border-slate-200 bg-bills-canvas py-24 text-slate-950 lg:py-32">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <div data-motion="reveal" className="mb-12">
          <p className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-[#3158e8]">Preguntas frecuentes</p>
          <h2 className="text-4xl font-black leading-[0.98] tracking-[-0.07em] sm:text-5xl">Lo importante, sin letra chica.</h2>
          <p className="mt-5 text-base leading-7 text-slate-600">Todo lo que necesitás saber para empezar con Bills.</p>
        </div>

        <div data-motion="stagger" className="flex flex-col gap-2">
          {landingFaqs.map((faq, index) => {
            const isOpen = openIndex === index;
            const answerId = `faq-answer-${index}`;
            return (
              <div data-motion-item key={faq.q} className="border-b border-slate-300">
                <button type="button" aria-expanded={isOpen} aria-controls={answerId} onClick={() => setOpenIndex(isOpen ? null : index)} className="flex min-h-16 w-full items-center justify-between gap-4 py-5 text-left transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bills-blue focus-visible:ring-offset-4">
                  <span className="text-base font-black tracking-[-0.02em]">{faq.q}</span>
                  <ChevronDown className={`h-5 w-5 shrink-0 text-[#3158e8] transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
                <div id={answerId} className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                  <div className="overflow-hidden">
                    <p className="max-w-2xl pb-5 pr-8 text-sm leading-6 text-slate-600">{faq.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
