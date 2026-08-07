import type { MetadataRoute } from "next";

// Web App Manifest: hace la app instalable (Android/Chrome) y define cómo se
// abre en modo standalone. En iOS el ícono de inicio sale de apple-icon.png.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bills",
    short_name: "Bills",
    description: "Gestión de ventas, caja, stock y clientes para negocios",
    lang: "es-AR",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Hex y no `var(--background)`: el manifest es JSON estático que lee el
    // sistema operativo, no CSS. La variable nunca se resolvía. Y siendo un
    // solo archivo para toda la app, tampoco puede cambiar con el rubro.
    background_color: "#f6f7fb",
    theme_color: "#1F6FFF",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
