import { ImageResponse } from "next/og";

import { brandIconElement } from "@/lib/brand-icon";

// Ícono de la app (pestaña del navegador + manifest). Se genera en build.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(brandIconElement(size.width), { ...size });
}
