"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Misma curva y misma duración que el bottom sheet de mobile (ver
// ui/bottom-sheet.tsx): es la de iOS, arranca rápido y frena largo, que es lo
// que hace que un panel se sienta empujado y no "movido por CSS". Las dos
// superficies tienen que sentirse el mismo gesto en distinta dirección, así
// que los números viven acá copiados a propósito y no cada uno inventando el
// suyo.
const CURVE = "cubic-bezier(0.32, 0.72, 0, 1)";
const ENTER_MS = 440;

/**
 * Panel modal que entra desde el borde derecho.
 *
 * Es un diálogo de verdad, no un div que aparece: atrapa el foco mientras está
 * abierto, cierra con Escape, devuelve el foco a donde estaba al cerrar y se
 * anuncia como `dialog` con nombre accesible. Sin eso, con el teclado se sigue
 * tabulando por la tabla de atrás —que está tapada por el fondo oscuro— y no
 * hay forma de saber que se abrió nada.
 *
 * Anima entrada Y salida: se mantiene montado hasta que termina la animación
 * de salida, con estilos inline (los mismos que usa el bottom sheet, que en
 * Safari son más confiables que las utilidades).
 */
export function SidePanel({
  open,
  onClose,
  children,
  title,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Nombre accesible del diálogo. No se dibuja: lo lee el lector de pantalla. */
  title: string;
  className?: string;
}) {
  const [render, setRender] = useState(open);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  // A dónde volver el foco cuando esto se cierre: casi siempre la fila de la
  // tabla que lo abrió. Si no se restaura, el foco se va al principio del
  // documento y hay que tabular la pantalla entera para volver a donde estabas.
  const focoPrevio = useRef<HTMLElement | null>(null);

  // Montar apenas se abre (setState en render: patrón admitido por React,
  // converge en un solo re-render).
  if (open && !render) {
    setRender(true);
  }

  useEffect(() => {
    if (open) {
      focoPrevio.current = document.activeElement as HTMLElement | null;
      document.body.style.overflow = "hidden";

      // Doble rAF para que el navegador pinte el estado inicial (fuera de
      // pantalla) antes de cambiar al final; si no, no hay transición, hay salto.
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }

    // Con `prefers-reduced-motion` la regla global de globals.css deja las
    // transiciones en 0.01ms, así que esperar los 440ms de la animación
    // dejaría un panel ya invisible tapando la pantalla —y su fondo oscuro
    // sigue siendo clickeable— casi medio segundo. Se desmonta en el acto.
    const sinAnimacion =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const timer = setTimeout(
      () => {
        setRender(false);
        setVisible(false);
        document.body.style.overflow = "";
      },
      sinAnimacion ? 0 : ENTER_MS,
    );
    return () => clearTimeout(timer);
  }, [open]);

  // Restaurar el scroll del body si esto se desmonta de golpe.
  useEffect(() => () => {
    document.body.style.overflow = "";
  }, []);

  // Foco inicial adentro del panel, y devolverlo al cerrar.
  useEffect(() => {
    if (!render || !open) return;

    const panel = panelRef.current;
    panel?.focus();

    return () => {
      focoPrevio.current?.focus?.();
    };
  }, [render, open]);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key !== "Tab") return;

    // Trampa de foco: sin esto el tabulador se escapa a la tabla de atrás, que
    // está tapada por el fondo oscuro — se navega a ciegas.
    const panel = panelRef.current;
    if (!panel) return;

    const focusables = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);

    if (focusables.length === 0) {
      event.preventDefault();
      panel.focus();
      return;
    }

    const primero = focusables[0];
    const ultimo = focusables[focusables.length - 1];
    const activo = document.activeElement;

    if (event.shiftKey && (activo === primero || activo === panel)) {
      event.preventDefault();
      ultimo.focus();
    } else if (!event.shiftKey && activo === ultimo) {
      event.preventDefault();
      primero.focus();
    }
  }

  if (!render) return null;

  return createPortal(
    <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, zIndex: 60 }}>
      <button
        aria-label="Cerrar"
        className="bg-slate-950/50"
        onClick={onClose}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          WebkitBackdropFilter: "blur(4px)",
          backdropFilter: "blur(4px)",
          opacity: open && visible ? 1 : 0,
          transition: `opacity 0.32s ease-out`,
        }}
        tabIndex={-1}
        type="button"
      />

      {/* Separado del borde y con esquinas redondeadas: apoyado sobre la
          pantalla en vez de cortado contra ella. Pegado al borde y en ángulo
          recto parecía que la ventana se había partido al medio, no que se
          hubiera abierto algo encima.

          El desplazamiento de salida se calcula con el margen incluido
          (`calc(100% + 0.75rem)`): con `100%` pelado el panel quedaba con su
          propio margen a la vista y la sombra asomaba por el costado en vez de
          irse del todo. */}
      <div
        aria-label={title}
        aria-modal="true"
        className={`flex flex-col overflow-hidden bg-white outline-none ${className}`}
        onKeyDown={onKeyDown}
        ref={panelRef}
        role="dialog"
        style={{
          position: "absolute",
          top: "0.75rem",
          right: "0.75rem",
          bottom: "0.75rem",
          width: "min(30rem, calc(100vw - 1.5rem))",
          borderRadius: "1.75rem",
          // Dos capas: la difusa da la sensación de "apoyado" y el anillo de
          // 1px lo recorta contra el fondo oscurecido, que si no le come el
          // borde. Misma familia que la sombra del bottom sheet.
          boxShadow: "0 32px 64px -16px rgba(15,23,42,0.32), 0 0 0 1px rgba(15,23,42,0.05)",
          willChange: "transform",
          transform: open && visible ? "translateX(0)" : "translateX(calc(100% + 0.75rem))",
          transition: `transform ${ENTER_MS}ms ${CURVE}`,
        }}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
