import { brandColors, brandIconPath, brandIconViewBox, type BrandVariant } from "./brand-assets";

type BrandLogoProps = {
  /** Tinta del logo según el contraste del fondo: "blue" en claro, "white" en oscuro. */
  variant: BrandVariant;
  /**
   * Alto del ícono en px (o unidad CSS). El wordmark se escala relativo al ícono
   * para mantener la proporción del diseño previo (ícono chico + texto grande).
   */
  height?: number | string;
  /** Solo el ícono (cuadrado redondeado), sin wordmark. Ideal para tamaños chicos. */
  iconOnly?: boolean;
  /** Clases extra del contenedor (p. ej. para el `-rotate-3` del navbar). */
  className?: string;
  /** Label accesible. Por defecto "Bills". */
  label?: string;
};

/**
 * Marca Bills: ícono (SVG del logo real) + wordmark "Bills" como texto con la
 * tipografía de la marca. La geometría del ícono viene de `brand-assets.ts`
 * (derivada del path completo del logo) y se rellena con la tinta según el
 * contraste del fondo:
 * - fondo oscuro → variant "white"
 * - fondo claro  → variant "blue"
 *
 * Se usa texto para el wordmark (no la logomarca completa apaisada) porque a
 * las alturas de navbar/footer/login (~30-34px) el wordmark vectorial del asset
 * queda ~12px y es ilegible; con texto se preserva el tamaño visual previo.
 */
export function BrandLogo({
  variant,
  height = 32,
  iconOnly = false,
  className,
  label = "Bills",
}: BrandLogoProps) {
  const fill = brandColors[variant];
  const h = typeof height === "number" ? height : parseFloat(String(height)) || 32;
  // viewBox del ícono → proporción del símbolo.
  const iconWidth = h * (brandIconViewBox.width / brandIconViewBox.height);

  const icon = (
    <svg
      aria-label={label}
      fill={fill}
      fillRule="evenodd"
      height={height}
      role="img"
      viewBox={`0 0 ${brandIconViewBox.width} ${brandIconViewBox.height}`}
      width={iconWidth}
    >
      <path d={brandIconPath} />
    </svg>
  );

  if (iconOnly) {
    return <span className={className ?? ""}>{icon}</span>;
  }

  // Marca completa: ícono + wordmark como texto. El texto usa la fuente y peso
  // de la marca (Funnel Sans, black, tracking apretado) para que sea legible a
  // alturas chicas; el color del texto acompaña la tinta del ícono.
  const wordmarkSize = Math.round(h * 0.7);

  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      {icon}
      <span
        className="font-funnel-sans font-black leading-none"
        style={{ color: fill, fontSize: wordmarkSize, letterSpacing: "-0.04em" }}
      >
        {label}
      </span>
    </span>
  );
}
