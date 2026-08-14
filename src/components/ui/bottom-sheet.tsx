"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

const EXIT_MS = 440;
const DEFAULT_DISMISS_THRESHOLD = 110;

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Clases extra para el panel (ej. min-h-[68dvh]). */
  panelClassName?: string;
  /** Píxeles de arrastre a partir de los cuales soltar cierra el sheet. */
  dismissThreshold?: number;
  /**
   * "sheet" (default) es la columna angosta de siempre. "dialog" se ensancha en
   * pantalla grande: hay formularios —la ficha de un producto— que en 460px son
   * un scroll interminable y en 820px entran de un vistazo.
   */
  size?: "sheet" | "dialog";
  /**
   * Monta el handle ENCIMA del contenido en vez de en su propia franja.
   *
   * Por defecto el handle ocupa una banda blanca arriba de todo, que es lo
   * correcto cuando abajo empieza un formulario. Pero cuando el contenido
   * arranca con una imagen a sangre —la ficha de un producto— esa banda deja
   * un vacío blanco entre el borde del sheet y la foto. Con esto la foto llega
   * hasta el borde y el handle flota encima, como el botón de cerrar.
   */
  handleOverlay?: boolean;
};

/**
 * Bottom sheet estilo iOS: portal a document.body, sube con la curva de Apple,
 * oscurece el fondo, y su handle superior permite arrastrar para cerrar
 * (swipe-to-dismiss). Anima entrada Y salida a partir de `open`. Las animaciones van
 * con estilos inline (confiables en iOS Safari).
 */
export function BottomSheet({
  open,
  onClose,
  children,
  panelClassName = "",
  dismissThreshold = DEFAULT_DISMISS_THRESHOLD,
  size = "sheet",
  handleOverlay = false,
}: BottomSheetProps) {
  const [render, setRender] = useState(open);
  const [visible, setVisible] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const dragStartY = useRef(0);

  // Montar apenas se abre (setState guardado en render: patrón admitido por React,
  // converge en un solo re-render y no dispara efectos en cascada).
  if (open && !render) {
    setRender(true);
  }

  // Entrada (doble rAF para que iOS pinte el estado inicial fuera de pantalla) y
  // salida (timeout que desmonta cuando terminó la animación). El setState va dentro
  // de callbacks (rAF/timeout), no sincrónico en el cuerpo del efecto.
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }

    const timer = setTimeout(() => {
      setRender(false);
      setVisible(false);
      setDragY(0);
      document.body.style.overflow = "";
    }, EXIT_MS);
    return () => clearTimeout(timer);
  }, [open]);

  // Restaurar el scroll del body si el componente se desmonta.
  useEffect(() => () => {
    document.body.style.overflow = "";
  }, []);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    draggingRef.current = true;
    dragStartY.current = event.clientY;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    setDragY(Math.max(0, event.clientY - dragStartY.current));
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ya liberado
    }

    const shouldClose = dragY > dismissThreshold;
    setDragging(false);
    setDragY(0);
    // Al cerrar, onClose (open=false) hace que el transform pase a translateY(100%);
    // como todo va batcheado en el handler, no hay salto: desliza desde el dedo.
    if (shouldClose) onClose();
  }

  if (!render) return null;

  const panelTransform = dragging
    ? `translateY(${dragY}px)`
    : open && visible
      ? "translateY(0)"
      : "translateY(100%)";

  return createPortal(
    <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, zIndex: 60 }}>
      <button
        aria-label="Cerrar"
        className="bg-slate-950/50"
        data-slot="bottom-sheet-backdrop"
        onClick={onClose}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          WebkitBackdropFilter: "blur(4px)",
          backdropFilter: "blur(4px)",
          opacity: open && visible ? Math.max(0, 1 - dragY / 500) : 0,
          transition: dragging ? "none" : "opacity 0.32s ease-out",
        }}
        type="button"
      />
      <div
        className={`mx-auto flex max-h-[92dvh] flex-col overflow-hidden rounded-t-[2.75rem] bg-white pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_-12px_50px_rgba(15,23,42,0.25)] ${
          size === "dialog"
            ? "max-w-[460px] sm:max-w-[860px] sm:rounded-2xl sm:pb-6"
            : "max-w-[460px]"
        } ${panelClassName}`}
        style={{
          position: "absolute",
          right: 0,
          bottom: 0,
          left: 0,
          willChange: "transform",
          transform: panelTransform,
          transition: dragging ? "none" : "transform 0.44s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        <div
          className={`touch-none cursor-grab justify-center active:cursor-grabbing ${
            handleOverlay
              ? // Encima del contenido: sin alto propio, para que lo de abajo
                // llegue al borde. Centrado y acotado a 8rem, NO de lado a
                // lado: a lo ancho taparía el botón de cerrar que flota en la
                // esquina de la foto y lo dejaría sin poder tocarse. Igual
                // quedan 44px de alto agarrables con el dedo.
                "absolute left-1/2 top-0 z-10 flex w-32 -translate-x-1/2 pb-6 pt-4"
              : "flex shrink-0 pb-1 pt-4"
          }`}
          onPointerCancel={onPointerUp}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {/* Sobre una foto el gris del pill desaparece: se pasa a blanco
              translúcido con sombra, el mismo tratamiento que el botón de
              cerrar que ya flota sobre la imagen. */}
          <div
            className={`h-1.5 w-11 rounded-full ${
              handleOverlay ? "bg-white/70 shadow-sm backdrop-blur-sm" : "bg-slate-200"
            }`}
          />
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
