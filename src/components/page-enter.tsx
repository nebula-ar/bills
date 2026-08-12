"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

gsap.registerPlugin(useGSAP);

// Transición skeleton → contenido (NEBU-37): cuando la página resuelve y
// reemplaza al skeleton, el contenido sube de abajo hacia arriba con un fade
// smooth (0.55s power2.out). Es la entrada estándar de las pantallas de
// gestión — reemplaza el fade CSS plano por un movimiento con dirección.
//
// Se envuelve el <main> de cada pantalla (AppShell y managers); los reveals y
// staggers internos conviven: el contenedor sube y adentro los ítems animan en
// la misma dirección.
//
// prefers-reduced-motion: con gsap.matchMedia el contenido queda visible
// directo, sin animación (mismo criterio que Reveal y la landing).

type PageEnterProps = {
  children: ReactNode;
  className?: string;
};

export function PageEnter({ children, className }: PageEnterProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;

      const media = gsap.matchMedia();

      media.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(root, { clearProps: "all" });
      });

      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(root, {
          autoAlpha: 0,
          y: 28,
          duration: 0.55,
          ease: "power2.out",
          // Al terminar, saca transform/opacity: los hovers CSS y los reveals
          // internos actúan sobre el estado natural.
          clearProps: "all",
        });
      });

      return () => media.revert();
    },
    { scope: rootRef },
  );

  return (
    <div ref={rootRef} className={className}>
      {children}
    </div>
  );
}
