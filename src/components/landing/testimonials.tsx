import { Quote } from "lucide-react";

import { landingTestimonials } from "./landing-content";

export function TestimonialsSection() {
  return (
    <section id="testimonios" className="border-t border-slate-200 bg-[#fffef9] py-24 text-slate-950 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-[#3158e8]">Hecho para el día a día</p>
            <h2 className="max-w-2xl text-4xl font-black leading-[0.98] tracking-[-0.07em] sm:text-5xl">
              Menos tiempo haciendo cuentas. Más tiempo atendiendo tu negocio.
            </h2>
          </div>
          <p className="max-w-xs text-sm leading-6 text-slate-500">Una misma base para equipos de productos, servicios y comercios de barrio.</p>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {landingTestimonials.map((testimonial) => (
            <article key={testimonial.author} className="flex min-h-[275px] flex-col justify-between rounded-3xl border border-slate-200 bg-[#f5f4ef] p-7">
              <div>
                <Quote className="h-6 w-6 text-[#3158e8]" aria-hidden="true" />
                <p className="mt-7 text-base font-semibold leading-7 text-slate-700">“{testimonial.quote}”</p>
              </div>
              <div className="mt-10 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-[#d7ef62] text-sm font-black text-slate-950">{testimonial.author.charAt(0)}</div>
                <div>
                  <p className="text-sm font-black text-slate-950">{testimonial.author}</p>
                  <p className="text-xs font-semibold text-slate-500">{testimonial.role} · {testimonial.business}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
