// Ícono de marca: el símbolo del logo real (cuadrado redondeado con el local
// en negativo), aislado del wordmark. Alimenta el favicon y el ícono de iOS.
// Se dibuja con SVG inline para que Satori (next/og) lo rasterice sin depender
// de archivos ni fuentes externas.
//
// El logo azul es la logomarca apaisada (ícono + wordmark); para 32/180 px el
// wordmark se pierde, así que acá va solo el símbolo, en azul sobre fondo
// claro. Antes se pintaba un glifo blanco sobre gradiente azul; ahora la tinta
// del logo azul es azul (#1F6FFF), así que el símbolo se renderiza azul sobre
// fondo claro (ver `brand-assets.ts`).
import type { ReactElement } from "react";

import { brandColors, brandIconPath, brandIconViewBox } from "./brand-assets";

export function brandIconElement(size: number): ReactElement {
  // El símbolo (444x520) no es cuadrado: se escala manteniendo la proporción
  // para no deformarlo dentro del cuadrado del ícono (512/180 px).
  const glyph = Math.round(size * 0.6);
  const glyphHeight = Math.round(glyph * (brandIconViewBox.height / brandIconViewBox.width));

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#ffffff",
      }}
    >
      <svg
        width={glyph}
        height={glyphHeight}
        viewBox={`0 0 ${brandIconViewBox.width} ${brandIconViewBox.height}`}
        fill={brandColors.blue}
        fillRule="evenodd"
      >
        <path d={brandIconPath} />
      </svg>
    </div>
  );
}
