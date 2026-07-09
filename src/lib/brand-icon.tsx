// Ícono de marca (tijera sobre gradiente azul) compartido por el favicon y el
// ícono de iOS. Se dibuja con SVG inline para que Satori (next/og) lo rasterice
// sin depender de archivos ni fuentes externas. Cuando haya logo real, se cambia
// solo este archivo.
import type { ReactElement } from "react";

export function brandIconElement(size: number): ReactElement {
  const glyph = Math.round(size * 0.52);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundImage: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
      }}
    >
      <svg
        width={glyph}
        height={glyph}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ffffff"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="6" cy="6" r="3" />
        <path d="M8.12 8.12 12 12" />
        <path d="M20 4 8.12 15.88" />
        <circle cx="6" cy="18" r="3" />
        <path d="M14.8 14.8 20 20" />
      </svg>
    </div>
  );
}
