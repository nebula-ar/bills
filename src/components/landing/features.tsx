import { ArrowUpRight } from "lucide-react";

import { landingFeatures } from "./landing-content";

export function FeaturesSection() {
  return (
    <section id="producto" className="border-t border-slate-200 bg-[#fffef9] py-24 text-slate-950 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="max-w-3xl">
          <p className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-[#3158e8]">El método Bills</p>
          <h2 className="text-4xl font-black leading-[0.98] tracking-[-0.07em] sm:text-5xl lg:text-6xl">
            De vender a decidir, sin saltar entre cinco herramientas.
          </h2>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
            Un solo lugar para registrar lo que pasa, entender cómo está tu negocio y saber qué hacer después.
          </p>
        </div>

        <div className="mt-16 grid border-t border-slate-300 md:grid-cols-3">
          {landingFeatures.map((feature, index) => (
            <article key={feature.kicker} className={`min-h-[245px] py-6 md:pr-8 ${index > 0 ? "border-t border-slate-300 md:border-l md:border-t-0 md:pl-8" : ""}`}>
              <p className="text-xs font-black text-[#3158e8]">{feature.kicker}</p>
              <h3 className="mt-10 max-w-xs text-2xl font-black tracking-[-0.05em]">{feature.title}</h3>
              <p className="mt-3 max-w-xs text-sm leading-6 text-slate-600">{feature.description}</p>
              <div className="mt-6 h-1 w-10 bg-[#d7ef62]" aria-hidden="true" />
            </article>
          ))}
        </div>

        <div className="mt-12 flex items-center gap-2 text-sm font-black text-[#3158e8]">
          <span>Una app que crece con tu negocio</span>
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}

export function AdaptableSection() {
  return (
    <section id="rubros" className="border-t border-slate-200 bg-[#e8e9ff] py-24 text-slate-950 lg:py-32">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20 lg:px-12">
        <div>
          <p className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-[#3158e8]">Un producto, varios mundos</p>
          <h2 className="max-w-lg text-4xl font-black leading-[0.98] tracking-[-0.07em] sm:text-5xl">
            La app cambia de vocabulario. La lógica sigue siendo tuya.
          </h2>
          <p className="mt-6 max-w-md text-sm leading-6 text-[#555b7a] sm:text-base">
            Elegís tu rubro al empezar y Bills te deja un espacio listo para vender. Después prendés o apagás módulos cuando los necesitás.
          </p>
        </div>
        <div className="border-t border-slate-950/20">
          <div className="flex flex-col gap-0 border-b border-slate-950/20 py-5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8">
            <strong className="text-2xl font-black tracking-[-0.05em]">Barbería y estética</strong>
            <span className="mt-1 text-sm text-[#555b7a] sm:mt-0 sm:text-right">Turnos · clientes · comisiones · caja</span>
          </div>
          <div className="flex flex-col gap-0 border-b border-slate-950/20 py-5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8">
            <strong className="text-2xl font-black tracking-[-0.05em]">Kiosco y almacén</strong>
            <span className="mt-1 text-sm text-[#555b7a] sm:mt-0 sm:text-right">Stock · códigos · proveedores · fiado</span>
          </div>
          <div className="flex flex-col gap-0 border-b border-slate-950/20 py-5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8">
            <strong className="text-2xl font-black tracking-[-0.05em]">Ropa y ferretería</strong>
            <span className="mt-1 text-sm text-[#555b7a] sm:mt-0 sm:text-right">Variantes · catálogo · presupuestos · promos</span>
          </div>
          <div className="flex flex-col gap-0 py-5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8">
            <strong className="text-2xl font-black tracking-[-0.05em]">Tu negocio</strong>
            <span className="mt-1 text-sm text-[#555b7a] sm:mt-0 sm:text-right">Elegí lo que aplica. Ocultá lo que sobra.</span>
          </div>
        </div>
      </div>
    </section>
  );
}
