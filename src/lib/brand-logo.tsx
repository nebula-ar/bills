import Image from "next/image";

import { brandColors, type BrandVariant } from "./brand-assets";

type BrandLogoProps = {
  /** Tinta del logo según el contraste del fondo: "blue" en claro, "white" en oscuro. */
  variant: BrandVariant;
  /** Alto del ícono en px (o unidad CSS). */
  height?: number | string;
  /** Solo el ícono (cuadrado redondeado), sin wordmark. Ideal para tamaños chicos. */
  iconOnly?: boolean;
  /** Clases extra del contenedor (p. ej. para el `-rotate-3` del navbar). */
  className?: string;
  /** Label accesible. Por defecto "Bills". */
  label?: string;
};

// Assets originales del logo (recortados a la zona de contenido), con el
// degradado y suavizado de los PNG provistos. `next/image` los optimiza y
// sirve en WebP/AVIF escalados.
const brandSrc = {
  blue: "/brand/icon-azul.png",
  white: "/brand/icon-blanco.png",
} as const;

// Proporción del badge recortado (456x532 / 456x550).
const iconRatio = {
  blue: 456 / 532,
  white: 456 / 550,
} as const;

/**
 * Marca Bills: ícono del logo (imagen PNG original, con degradado) + wordmark
 * "Bills" como texto con la tipografía de la marca.
 *
 * Se usa la imagen original del ícono (no una reconstrucción vectorial) para
 * respetar el degradado y suavizado del asset provisto. El wordmark va como
 * texto (Funnel Sans black) porque dentro de la logomarca apaisada a alturas de
 * navbar/footer/login (~30-34px) queda ilegible; con texto se preserva el
 * tamaño visual previo.
 *
 * Contraste del fondo:
 * - fondo oscuro → variant "white"
 * - fondo claro  → variant "blue"
 */
export function BrandLogo({
  variant,
  height = 32,
  iconOnly = false,
  className,
  label = "Bills",
}: BrandLogoProps) {
  const h = typeof height === "number" ? height : parseFloat(String(height)) || 32;
  const iconWidth = h * iconRatio[variant];

  const icon = (
    <Image
      alt={iconOnly ? label : ""}
      aria-hidden={!iconOnly ? "true" : undefined}
      height={h}
      role={iconOnly ? "img" : undefined}
      src={brandSrc[variant]}
      unoptimized={false}
      width={iconWidth}
    />
  );

  if (iconOnly) {
    return <span className={className ?? ""}>{icon}</span>;
  }

  // Marca completa: ícono (imagen original) + wordmark como texto.
  const wordmarkSize = Math.round(h * 0.7);

  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      {icon}
      <span
        className="font-funnel-sans font-black leading-none"
        style={{ color: brandColors[variant], fontSize: wordmarkSize, letterSpacing: "-0.04em" }}
      >
        {label}
      </span>
    </span>
  );
}
