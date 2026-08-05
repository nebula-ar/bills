"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { landingFaqs } from "./landing-content";

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="border-t border-slate-200 bg-[var(--card)] py-24 text-slate-950 lg:py-32">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <div className="mb-12">
          <p className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-[var(--primary)]">Preguntas frecuentes</p>
          <h2 className="text-4xl font-black leading-[0.98] tracking-[-0.07em] sm:text-5xl">Lo importante, sin letra chica.</h2>
          <p className="mt-5 text-base leading-7 text-slate-600">Todo lo que necesitás saber para empezar con Bills.</p>
        </div>

        <div className="flex flex-col gap-2">
          {landingFaqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={faq.q} className="border-b border-slate-300">
                <button type="button" aria-expanded={isOpen} onClick={() => setOpenIndex(isOpen ? null : index)} className="flex min-h-16 w-full items-center justify-between gap-4 py-5 text-left">
                  <span className="text-base font-black tracking-[-0.02em]">{faq.q}</span>
                  <ChevronDown className={`h-5 w-5 shrink-0 text-[var(--primary)] transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
                {isOpen ? <p className="max-w-2xl pb-5 pr-8 text-sm leading-6 text-slate-600">{faq.a}</p> : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
