// Ícono de marca (un local sobre gradiente azul) compartido por el favicon y el
// ícono de iOS. Se dibuja con SVG inline para que Satori (next/og) lo rasterice
// sin depender de archivos ni fuentes externas. Cuando haya logo real, se cambia
// solo este archivo.
//
// Era una tijera cuando el producto era solo para barberías; ahora Bills le sirve
// a cualquier comercio, así que la marca no puede casarse con un rubro.
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
        <path d="M3 9.5 4.5 4h15L21 9.5" />
        <path d="M3 9.5a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 3 0" />
        <path d="M5 11.5V20h14v-8.5" />
        <path d="M9.5 20v-5h5v5" />
      </svg>
    </div>
  );
}
