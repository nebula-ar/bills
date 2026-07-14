"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function CurvedDivider() {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const flatPath = "M0,0 C300,0 900,0 1200,0 L1200,120 L0,120 Z";
    const curvedPath = "M0,0 C300,150 900,150 1200,0 L1200,120 L0,120 Z";

    if (containerRef.current && pathRef.current) {
      // Set initial flat path
      gsap.set(pathRef.current, { attr: { d: flatPath } });

      gsap.to(pathRef.current, {
        attr: { d: curvedPath },
        ease: "power1.inOut",
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 95%", // Empezar un poquito antes
          end: "bottom 80%", // Terminar un poco más abajo para que la curva sea gradual
          scrub: 1.5, // Le da una inercia de 1.5 segundos (mucho más "smooth")
        }
      });
    }

    return () => {
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, []);

  return (
    <div ref={containerRef} className="absolute -bottom-[1px] inset-x-0 w-full overflow-hidden leading-[0] pointer-events-none translate-y-[1px]">
      <svg 
        viewBox="0 0 1200 120" 
        preserveAspectRatio="none" 
        className="relative block w-full h-[60px] sm:h-[100px] lg:h-[140px]"
      >
        <path 
          ref={pathRef}
          d="M0,0 C300,0 900,0 1200,0 L1200,120 L0,120 Z" 
          fill="#0A0A0B" 
        />
      </svg>
    </div>
  );
}
