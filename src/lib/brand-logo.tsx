import {
  brandColors,
  brandIconPath,
  brandIconViewBox,
  brandLogoPath,
  brandLogoViewBox,
  type BrandVariant,
} from "./brand-assets";

type BrandLogoProps = {
  /** Tinta del logo según el contraste del fondo: "blue" en claro, "white" en oscuro. */
  variant: BrandVariant;
  /**
   * Alto en px (o cualquier unidad CSS). El ancho se deriva de la proporción del
   * asset (logomarca completa o solo ícono) para no deformar la geometría.
   */
  height?: number | string;
  /** Solo el ícono (cuadrado redondeado), sin wordmark. Ideal para tamaños chicos. */
  iconOnly?: boolean;
  /** Clases extra del contenedor/ícono (p. ej. para el `-rotate-3` del navbar). */
  className?: string;
  /** Label accesible. Por defecto "Bills". */
  label?: string;
};

/**
 * Marca Bills como SVG inline. Única fuente de render: no repetir PNG por
 * pantalla. La geometría viene de `brand-assets.ts` (trazada del logo real) y
 * se rellena con la tinta correspondiente al contraste del fondo:
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
  const fill = brandColors[variant];

  if (iconOnly) {
    const h = typeof height === "number" ? height : parseFloat(String(height)) || 32;
    // viewBox 444x520 → cuadrado cercano; escalamos para que el alto domine.
    return (
      <svg
        aria-label={label}
        className={className}
        fill={fill}
        fillRule="evenodd"
        height={height}
        role="img"
        viewBox={`0 0 ${brandIconViewBox.width} ${brandIconViewBox.height}`}
        width={h * (brandIconViewBox.width / brandIconViewBox.height)}
      >
        <path d={brandIconPath} />
      </svg>
    );
  }

  const h = typeof height === "number" ? height : parseFloat(String(height)) || 32;
  // Logomarca apaisada (1536x1024): el contenido útil va de x≈522 a x≈1000,
  // es decir ~478/1536 del ancho. Recortamos el viewBox al contenido para que
  // el componente no arrastre aire.
  return (
    <svg
      aria-label={label}
      className={className}
      fill={fill}
      fillRule="evenodd"
      height={height}
      role="img"
      viewBox="521 233 480 520"
      width={h * (480 / 520)}
    >
      <path d={brandLogoPath} />
    </svg>
  );
}
