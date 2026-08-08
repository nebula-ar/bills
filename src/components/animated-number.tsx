"use client";

import { useEffect, useRef, useState } from "react";

const moneyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const intFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 0,
});

// easeOutExpo — arranca rápido y desacelera suave al final.
function easeOutExpo(t: number) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

// Cuenta de 0 al valor inicial al montar (dashboard) y del valor ANTERIOR al
// nuevo en los cambios siguientes (total del presupuesto). Si la animación se
// corta a mitad, la siguiente corrida arranca del último valor interpolado
// mostrado, para que un tecleo rápido no tire el total a 0.
function useCountUp(value: number, durationMs: number, delayMs: number) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const currentRef = useRef(0);
  const frameRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    // Sin animación (reduced-motion o duración nula): saltar al valor final en el
    // próximo frame (setState dentro del callback de rAF, no sincrónico en el efecto).
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || durationMs <= 0) {
      fromRef.current = value;
      currentRef.current = value;
      frameRef.current = requestAnimationFrame(() => setDisplay(value));
      return () => cancelAnimationFrame(frameRef.current);
    }

    const from = fromRef.current;
    if (from === value) return;

    let startTime: number | null = null;

    const step = (now: number) => {
      if (startTime === null) startTime = now;
      const progress = Math.min((now - startTime) / durationMs, 1);
      const current = from + (value - from) * easeOutExpo(progress);
      currentRef.current = current;
      setDisplay(current);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = value;
      }
    };

    timeoutRef.current = setTimeout(() => {
      frameRef.current = requestAnimationFrame(step);
    }, delayMs);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      cancelAnimationFrame(frameRef.current);
      // Continuar desde donde quedó: evita que el próximo cambio parta de 0.
      fromRef.current = currentRef.current;
    };
  }, [value, durationMs, delayMs]);

  return display;
}

type AnimatedProps = {
  value: number;
  className?: string;
  durationMs?: number;
  delayMs?: number;
};

export function AnimatedMoney({ value, className, durationMs = 1100, delayMs = 0 }: AnimatedProps) {
  const display = useCountUp(value, durationMs, delayMs);
  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {moneyFormatter.format(Math.round(display))}
    </span>
  );
}

export function AnimatedNumber({ value, className, durationMs = 900, delayMs = 0 }: AnimatedProps) {
  const display = useCountUp(value, durationMs, delayMs);
  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {intFormatter.format(Math.round(display))}
    </span>
  );
}
