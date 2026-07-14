"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
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
  const containerRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: containerRef.current,
        start: "top 80%",
        toggleActions: "play none none reverse"
      }
    });

    tl.fromTo(titleRef.current, 
      { opacity: 0, y: -30, scale: 0.95 }, 
      { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: "back.out(1.7)" }
    )
    .fromTo(cardsRef.current, 
      { opacity: 0, y: 80, rotation: 3 }, 
      { opacity: 1, y: 0, rotation: 0, duration: 0.7, stagger: 0.15, ease: "back.out(1.2)" },
      "-=0.4"
    );

    // 3D Tilt Effect
    const handleMouseMove = (e: MouseEvent, card: HTMLDivElement) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = ((y - centerY) / centerY) * -8; // Máx 8 grados
      const rotateY = ((x - centerX) / centerX) * 8;
      
      gsap.to(card, {
        rotationX: rotateX,
        rotationY: rotateY,
        transformPerspective: 1000,
        ease: "power2.out",
        duration: 0.4
      });
      
      // Efecto parallax en el texto y avatar
      const content = card.querySelector('.card-content');
      const avatar = card.querySelector('.card-avatar');
      
      if (content) {
         gsap.to(content, { x: rotateY * 1.2, y: rotateX * -1.2, ease: "power2.out", duration: 0.4 });
      }
      if (avatar) {
         gsap.to(avatar, { x: rotateY * 2.5, y: rotateX * -2.5, scale: 1.1, ease: "power2.out", duration: 0.4 });
      }
    };

    const handleMouseLeave = (card: HTMLDivElement) => {
      gsap.to(card, { rotationX: 0, rotationY: 0, ease: "power3.out", duration: 0.6 });
      
      const content = card.querySelector('.card-content');
      const avatar = card.querySelector('.card-avatar');
      
      if (content) gsap.to(content, { x: 0, y: 0, ease: "power3.out", duration: 0.6 });
      if (avatar) gsap.to(avatar, { x: 0, y: 0, scale: 1, ease: "power3.out", duration: 0.6 });
    };

    const cards = cardsRef.current;
    
    cards.forEach(card => {
      if (!card) return;
      const onMove = (e: MouseEvent) => handleMouseMove(e, card);
      const onLeave = () => handleMouseLeave(card);
      card.addEventListener("mousemove", onMove);
      card.addEventListener("mouseleave", onLeave);
      
      (card as any)._onMove = onMove;
      (card as any)._onLeave = onLeave;
    });

    return () => {
      cards.forEach(card => {
        if (!card) return;
        card.removeEventListener("mousemove", (card as any)._onMove);
        card.removeEventListener("mouseleave", (card as any)._onLeave);
      });
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, []);

  return (
    <section ref={containerRef} id="testimonials" className="py-24 bg-white border-t border-slate-200 snap-start overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 ref={titleRef} className="text-3xl lg:text-5xl font-bold text-slate-900 mb-6 font-montserrat">
            Elegido por las <span className="text-blue-600">mejores barberías.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6 perspective-1000">
          {testimonials.map((t, i) => (
            <div
              key={i}
              ref={el => { cardsRef.current[i] = el }}
              className="group p-8 rounded-[2rem] bg-slate-50 border border-slate-100 flex flex-col justify-between transition-shadow duration-300 hover:shadow-[0_20px_40px_-15px_rgba(37,99,235,0.15)] hover:border-blue-100 transform-style-3d"
              style={{ transformStyle: 'preserve-3d' }}
            >
              <div className="card-content">
                <div className="flex gap-1 mb-6">
                  {[1, 2, 3, 4, 5].map((star, starIdx) => (
                    <Star 
                      key={star} 
                      className="w-4 h-4 fill-blue-500 text-blue-500 transition-transform duration-300 group-hover:scale-125 group-hover:-rotate-12" 
                      style={{ transitionDelay: `${starIdx * 50}ms` }}
                    />
                  ))}
                </div>
                <p className="text-slate-600 leading-relaxed mb-8 italic text-[15px]">
                  &quot;{t.quote}&quot;
                </p>
              </div>
              <div className="flex items-center gap-4 card-content">
                <div className="card-avatar w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center font-bold text-blue-700 shadow-sm transition-colors duration-300">
                  {t.author.charAt(0)}
                </div>
                <div>
                  <p className="text-slate-900 font-bold tracking-tight">{t.author}</p>
                  <p className="text-[13px] font-medium text-slate-500">{t.role} @ {t.shop}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
