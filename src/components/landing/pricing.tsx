import Link from "next/link";
import { Check } from "lucide-react";

import { landingPlans } from "./landing-content";

export function PricingSection() {
  return (
    <section id="precios" className="border-t border-slate-200 bg-[#f5f4ef] py-24 text-slate-950 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="max-w-2xl">
          <p className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-[#3158e8]">Precios claros</p>
          <h2 className="text-4xl font-black leading-[0.98] tracking-[-0.07em] sm:text-5xl">Pagás por las herramientas que necesitás. Nada más.</h2>
          <p className="mt-6 text-base leading-7 text-slate-600 sm:text-lg">Cuota fija, 0% de comisión sobre tus ventas y 14 días para probar sin tarjeta.</p>
        </div>

        <div className="mt-14 grid items-start gap-4 lg:grid-cols-3">
          {landingPlans.map((plan) => (
            <article key={plan.name} className={`relative flex h-full flex-col rounded-3xl border p-7 ${plan.highlighted ? "border-slate-950 bg-slate-950 text-white shadow-[0_24px_60px_-22px_rgba(17,19,21,0.7)] lg:-translate-y-3" : "border-slate-300 bg-[#fffef9]"}`}>
              {plan.highlighted ? <span className="absolute -top-3 left-7 rounded-full bg-[#d7ef62] px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-slate-950">Más elegido</span> : null}
              <h3 className="text-xl font-black tracking-[-0.04em]">{plan.name}</h3>
              <p className={`mt-3 min-h-12 text-sm leading-6 ${plan.highlighted ? "text-slate-300" : "text-slate-500"}`}>{plan.description}</p>
              <div className="mt-7 flex items-baseline gap-2"><strong className="text-4xl font-black tracking-[-0.07em]">$ {plan.price}</strong><span className={plan.highlighted ? "text-slate-400" : "text-slate-500"}>ARS {plan.period}</span></div>
              <ul className="mt-8 flex flex-1 flex-col gap-3">
                {plan.features.map((feature) => <li key={feature} className={`flex items-start gap-2 text-sm leading-5 ${plan.highlighted ? "text-slate-200" : "text-slate-600"}`}><Check className={`mt-0.5 h-4 w-4 shrink-0 ${plan.highlighted ? "text-[#d7ef62]" : "text-[#3158e8]"}`} aria-hidden="true" />{feature}</li>)}
              </ul>
              <Link href={plan.cta === "Hablar con ventas" ? "/contact" : "/register"} className={`mt-8 inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-sm font-black transition hover:-translate-y-0.5 ${plan.highlighted ? "bg-[#d7ef62] text-slate-950 hover:bg-white" : "border border-slate-950 bg-slate-950 text-white hover:bg-[#3158e8]"}`}>{plan.cta}</Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
