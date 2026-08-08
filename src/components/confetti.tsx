"use client";

// Confetti sutil para momentos de cierre (venta registrada, cuenta creada).
// Vive en su propio componente para poder reusarse sin duplicar el CSS:
// la animación es la misma cascada de `register-wizard` y respeta
// `prefers-reduced-motion` desde el CSS global (los `animation` inline quedan
// anulados por la regla `motion-safe` de globals.css).

const CONFETTI = Array.from({ length: 18 }, (_, i) => ({
  left: (i * 5.6 + (i % 4) * 3) % 100,
  delay: (i % 6) * 0.12,
  duration: 1.9 + (i % 4) * 0.25,
  color: ["var(--primary)", "var(--accent-brand)", "#0f172a", "var(--primary)", "var(--accent-brand)"][i % 5],
  size: 7 + (i % 3) * 4,
}));

export function Confetti() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {CONFETTI.map((piece, i) => (
        <span
          className="absolute top-0 rounded-sm"
          key={i}
          style={{
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.size * 1.6,
            backgroundColor: piece.color,
            animation: `bbFall ${piece.duration}s linear ${piece.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}
