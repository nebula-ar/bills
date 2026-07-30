import type { MetadataRoute } from "next";

// Web App Manifest: hace la app instalable (Android/Chrome) y define cómo se
// abre en modo standalone. En iOS el ícono de inicio sale de apple-icon.tsx.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bills",
    short_name: "Bills",
    description: "Administración de ventas para negocios",
    lang: "es-AR",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f7fb",
    theme_color: "#2563eb",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
