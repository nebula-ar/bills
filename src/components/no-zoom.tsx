"use client";

import { useEffect } from "react";

/**
 * Bloquea el zoom por gestos en iOS Safari (que ignora `user-scalable=no`).
 * El doble-tap zoom se corta con `touch-action: manipulation` en el CSS global;
 * acá cortamos el pinch-zoom (gestos) sin afectar el scroll ni los taps rápidos.
 */
export function NoZoom() {
  useEffect(() => {
    const preventGesture = (event: Event) => event.preventDefault();

    // Eventos de gesto propios de Safari (pinch-zoom).
    document.addEventListener("gesturestart", preventGesture);
    document.addEventListener("gesturechange", preventGesture);
    document.addEventListener("gestureend", preventGesture);

    // Fallback: cancelar el pinch con dos dedos (no afecta el scroll de un dedo).
    const preventMultiTouch = (event: TouchEvent) => {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    };
    document.addEventListener("touchmove", preventMultiTouch, { passive: false });

    return () => {
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("gestureend", preventGesture);
      document.removeEventListener("touchmove", preventMultiTouch);
    };
  }, []);

  return null;
}
