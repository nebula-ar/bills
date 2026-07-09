import { ImageResponse } from "next/og";

import { brandIconElement } from "@/lib/brand-icon";

// Ícono para "Agregar a inicio" en iOS. 180×180, fondo opaco (iOS ignora la
// transparencia y redondea las esquinas por su cuenta).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(brandIconElement(size.width), { ...size });
}
