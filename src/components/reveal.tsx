"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

gsap.registerPlugin(useGSAP);

// Entrada de contenido de las pantallas de gestión (NEBU-33).
//
// Reemplaza los `animate-in` + delays inline ad-hoc por un único momento
// animado por pantalla: las listas y grillas entran con un stagger suave de
// 60–80ms, solo transform/opacity (GPU-friendly, sin layout thrash) y
// `clearProps` al terminar para que los hovers CSS actúen sobre el estado
// natural.
//
// Targets: si hay descendientes con `data-reveal-item`, se animan esos (con
// stagger); si no, se animan los hijos directos del wrapper.
//
// prefers-reduced-motion: con `gsap.matchMedia` el contenido queda visible
// directo, sin animación (mismo criterio que la landing).

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Retraso entre ítems, en segundos. */
  stagger?: number;
  /** Desplazamiento vertical inicial, en px. */
  y?: number;
};

export function Reveal({ children, className, stagger = 0.07, y = 16 }: RevealProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;

      const marked = root.querySelectorAll<HTMLElement>("[data-reveal-item]");
      const items = marked.length > 0 ? marked : Array.from(root.children);
      if (items.length === 0) return;

      const media = gsap.matchMedia();

      media.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(items, { clearProps: "all" });
      });

      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(items, {
          autoAlpha: 0,
          y,
          duration: 0.42,
          ease: "power2.out",
          stagger,
          // Al terminar, saca el transform inline: los hovers CSS (elevación)
          // pueden actuar después del reveal.
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
