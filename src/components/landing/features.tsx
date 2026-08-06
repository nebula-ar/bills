import { ArrowUpRight } from "lucide-react";
import Image from "next/image";

import { landingFeatures } from "./landing-content";

const featureIllustrations = [
  {
    image: "/landing/illustrations/register-v2.webp",
    alt: "Una comerciante cobrando una venta con un dispositivo sin contacto",
  },
  {
    image: "/landing/illustrations/organize-v2.webp",
    alt: "Comprobantes y productos desordenados convirtiéndose en información organizada",
  },
  {
    image: "/landing/illustrations/decide-v2.webp",
    alt: "Una comerciante revisando un reporte y eligiendo el siguiente paso",
  },
] as const;

export function FeaturesSection() {
  return (
    <section id="producto" className="border-t border-slate-200 bg-bills-canvas py-24 text-slate-950 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <div data-motion="reveal" className="max-w-3xl">
          <p className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-[#3158e8]">El método Bills</p>
          <h2 className="text-4xl font-black leading-[0.98] tracking-[-0.07em] sm:text-5xl lg:text-6xl">
            De vender a decidir, sin saltar entre cinco herramientas.
          </h2>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
            Un solo lugar para registrar lo que pasa, entender cómo está tu negocio y saber qué hacer después.
          </p>
        </div>

        <div data-motion="stagger" className="mt-16 grid border-t border-slate-300 md:grid-cols-3">
          {landingFeatures.map((feature, index) => (
            <article data-motion-item key={feature.kicker} className={`group min-h-[245px] py-6 md:pr-8 ${index > 0 ? "border-t border-slate-300 md:border-l md:border-t-0 md:pl-8" : ""}`}>
              <p className="text-xs font-black text-[#3158e8]">{feature.kicker}</p>
              <div className="relative mt-6 aspect-[5/4] overflow-hidden rounded-[2rem] bg-bills-paper sm:aspect-[4/3] md:aspect-square">
                <Image
                  src={featureIllustrations[index].image}
                  alt={featureIllustrations[index].alt}
                  fill
                  sizes="(min-width: 768px) 33vw, 100vw"
                  className="object-contain transition-transform duration-300 ease-out group-hover:scale-[1.025] motion-reduce:transition-none"
                  placeholder="blur"
                />
              </div>
              <h3 className="mt-7 max-w-xs text-2xl font-black tracking-[-0.05em]">{feature.title}</h3>
              <p className="mt-3 max-w-xs text-sm leading-6 text-slate-600">{feature.description}</p>
              <div className="mt-6 h-1 w-10 origin-left bg-bills-lime transition-transform duration-300 group-hover:scale-x-150 motion-reduce:transition-none" aria-hidden="true" />
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
  const worlds = [
    ["Barbería y estética", "Turnos · clientes · comisiones · caja"],
    ["Kiosco y almacén", "Stock · códigos · proveedores · fiado"],
    ["Ropa y ferretería", "Variantes · catálogo · presupuestos · promos"],
    ["Tu negocio", "Elegí lo que aplica. Ocultá lo que sobra."],
  ] as const;

  return (
    <section id="rubros" className="overflow-hidden border-t border-slate-200 bg-bills-blue-soft py-24 text-slate-950 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <div data-motion="reveal" className="max-w-3xl">
          <p className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-[#3158e8]">Un producto, varios mundos</p>
          <h2 className="max-w-2xl text-4xl font-black leading-[0.98] tracking-[-0.07em] sm:text-5xl lg:text-6xl">
            La app cambia de vocabulario. La lógica sigue siendo tuya.
          </h2>
          <p className="mt-6 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
            Elegís tu rubro al empezar y Bills te deja un espacio listo para vender. Después prendés o apagás módulos cuando los necesitás.
          </p>
        </div>

        <div className="mt-14 grid items-stretch gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-12">
          <div data-motion="stagger" className="flex flex-col border-t border-slate-950/20">
            {worlds.map(([name, description], index) => (
              <article
                data-motion-item
                key={name}
                className={`group flex flex-1 flex-col justify-center border-b border-slate-950/20 py-5 transition-transform duration-200 motion-reduce:transition-none sm:px-1 lg:hover:translate-x-2 ${index === 0 ? "lg:pt-0" : ""}`}
              >
                <span className="text-[10px] font-black tracking-[0.16em] text-bills-blue">0{index + 1}</span>
                <strong className="mt-2 text-xl font-black tracking-[-0.05em] sm:text-2xl">{name}</strong>
                <span className="mt-1 text-sm leading-6 text-slate-600">{description}</span>
              </article>
            ))}
          </div>

          <figure data-motion="reveal" className="relative order-first min-h-[390px] overflow-hidden rounded-[2rem] border border-slate-950/10 bg-bills-paper shadow-lg shadow-blue-950/10 sm:min-h-[520px] lg:order-none">
            <div data-motion="world-image" className="absolute -inset-y-8 inset-x-0 will-change-transform">
              <Image
                src="/landing/business-worlds-v2.webp"
                alt="Sillón de barbería, mercadería, ropa y herramientas conectados a un mismo sistema de gestión"
                fill
                sizes="(min-width: 1024px) 60vw, 100vw"
                className="object-cover"
                placeholder="blur"
              />
            </div>
            <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-bills-ink/85 to-transparent" aria-hidden="true" />
            <figcaption className="absolute bottom-5 left-5 right-5 flex flex-col items-start justify-between gap-3 sm:bottom-7 sm:left-7 sm:right-7 sm:flex-row sm:items-end">
              <div className="rounded-2xl bg-bills-lime px-4 py-3 text-bills-ink shadow-sm">
                <strong className="block text-sm font-black">Un core. Cuatro mundos.</strong>
                <span className="mt-1 block text-xs font-semibold text-slate-700">La misma lógica, el idioma de tu negocio.</span>
              </div>
              <span className="rounded-full border border-white/30 bg-bills-ink/80 px-4 py-2 text-xs font-black text-white backdrop-blur-md">Crece sin cambiar de sistema</span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
