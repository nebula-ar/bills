"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { Store } from "lucide-react";

export function Preloader() {
  const containerRef = useRef<HTMLDivElement>(null);
  const brandGroupRef = useRef<HTMLDivElement>(null);
  const textWrapperRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    // Lock scrolling initially before paint
    document.body.style.overflow = "hidden";
    
    // Ensure the page always starts at the very top
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const tl = gsap.timeline({
      onComplete: () => {
        document.body.style.overflow = "auto";
        if (containerRef.current) {
          containerRef.current.style.pointerEvents = "none";
        }
      }
    });
    if (prefersReducedMotion) {
      // Resuelve la intro casi al instante para no tapar el hero con un cruce de opacidad prolongado.
      tl.timeScale(20);
    }

    const letters = textWrapperRef.current?.querySelectorAll('.char');
    const icon = brandGroupRef.current?.querySelector('.icon-wrapper');

    if (!letters || !icon || !bgRef.current || !brandGroupRef.current) return;

    // 1. Setup initial state
    const isMobile = window.innerWidth < 768;
    const initialScale = isMobile ? 1.5 : 2.5;
    gsap.set(brandGroupRef.current, { xPercent: -50, yPercent: -50, scale: initialScale });
    gsap.set(letters, { y: 30, opacity: 0 }); // Menos distancia de 'y' porque la fuente es más chica
    gsap.set(icon, { scale: 0, opacity: 0, rotation: -90 });

    // 2. Animate icon pop in
    tl.to(icon, {
      scale: 1,
      opacity: 1,
      rotation: 0,
      duration: 1,
      ease: "elastic.out(1, 0.5)"
    })
    // 3. Animate text letter by letter
    .to(letters, {
      y: 0,
      opacity: 1,
      duration: 0.8,
      stagger: 0.05,
      ease: "power4.out"
    }, "-=0.6")
    // 4. Pause to let the user see the logo
    .to({}, { duration: 0.5 })
    // 5. Fade out background
    .to(bgRef.current, {
      opacity: 0,
      duration: 1,
      ease: "power2.inOut",
      // El hero espera este evento para arrancar su propia entrada: evita que
      // ambas animaciones se crucen y generen un frame de bajo contraste
      // (lo que hacía fallar el audit de accesibilidad de forma intermitente).
      onComplete: () => window.dispatchEvent(new Event("preloader:bg-hidden")),
    }, "+=0.3")
    
    // 6. Shrink and move the logo to the exact navbar position
    .to(brandGroupRef.current, {
      top: () => {
        const placeholder = document.getElementById("navbar-logo-placeholder");
        if (placeholder) {
          const rect = placeholder.getBoundingClientRect();
          return `${rect.top + rect.height / 2}px`;
        }
        return "1rem";
      },
      left: () => {
        const placeholder = document.getElementById("navbar-logo-placeholder");
        if (placeholder) {
          const rect = placeholder.getBoundingClientRect();
          return `${rect.left + rect.width / 2}px`;
        }
        return "24px";
      },
      xPercent: -50,
      yPercent: -50,
      scale: 1, 
      duration: 1.2,
      ease: "expo.inOut",
      transformOrigin: "center center"
    }, "<") // animate simultaneously with background fade
    .add(() => {
       const placeholder = document.getElementById("navbar-logo-placeholder");
       if (placeholder) {
         gsap.to(placeholder, { opacity: 1, duration: 0.3 });
       }
    })
    .to(brandGroupRef.current, {
      opacity: 0,
      duration: 0.3
    }, "-=0.2");

    return () => {
      document.body.style.overflow = "auto";
      tl.kill();
    };
  }, []);

  const brandText = "Bills".split("");

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-auto"
    >
      {/* Background layer */}
      <div ref={bgRef} className="absolute inset-0 bg-slate-50" />

      {/* Brand Group that moves to Navbar */}
      <div 
        ref={brandGroupRef} 
        className="absolute top-1/2 left-1/2 flex items-center gap-3"
      >
        <div className="icon-wrapper w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shrink-0">
          <Store className="w-5 h-5 text-white" />
        </div>
        <div ref={textWrapperRef} className="overflow-hidden flex">
          {brandText.map((char, index) => (
            <span 
              key={index} 
              className={`char text-xl font-bold text-slate-900 tracking-tight font-montserrat inline-block ${char === " " ? "w-1.5" : ""}`}
            >
              {char}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
