import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter, Montserrat } from "next/font/google";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { FlashToaster } from "@/components/flash-toaster";
import { InstallPrompt } from "@/components/install-prompt";
import { MobileNav } from "@/components/mobile-nav";
import { buildNav } from "@/lib/app-modules";
import { verticalPreset } from "@/lib/vertical";
import { getCurrentSession, isAdminRole } from "@/lib/auth";
import { findBusinessContext } from "@/lib/business-context";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://barber-bills-tawny.vercel.app"),
  title: "Bills",
  description: "Ventas, caja, stock, clientes y proveedores para tu negocio",
  applicationName: "Bills",
  // Habilita "Agregar a inicio" en iOS a pantalla completa (modo standalone).
  appleWebApp: {
    capable: true,
    title: "Bills",
    statusBarStyle: "default",
  },
  // Next 16 emite el `mobile-web-app-capable` moderno; agregamos el legacy de
  // Apple para que iOS viejo también abra a pantalla completa desde el inicio.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

// Permitimos el zoom del usuario (accesibilidad, WCAG 1.4.4). El doble-tap-zoom
// accidental ya se evita con `touch-action: manipulation` en el CSS global, así
// que dejar pellizcar para acercar no desconfigura la vista tipo POS.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#2563eb",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getCurrentSession();
  const showNav = isAdminRole(session?.user.role);

  // La navegación depende del negocio (rubro + módulos prendidos), así que se
  // arma acá con los datos ya resueltos y viaja al cliente lista para pintar.
  const business = showNav && session ? await findBusinessContext(session.user.businessId) : null;
  const nav = business ? buildNav(business.labels, business.modules, verticalPreset(business.vertical).catalogIcon) : null;

  return (
    <html
      lang="es-AR"
      // El rubro pinta la app entera: los componentes usan ranuras semánticas
      // y el bloque [data-vertical] de globals.css las redefine. Sin esto el
      // bloque existe pero nunca aplica.
      data-vertical={business?.vertical}
      className={`${inter.variable} ${geistMono.variable} ${montserrat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background">
        {children}
        {nav ? <MobileNav nav={nav} /> : null}
        <InstallPrompt />
        <Toaster position="top-center" richColors toastOptions={{ className: "font-semibold" }} />
        <Suspense fallback={null}>
          <FlashToaster />
        </Suspense>
      </body>
    </html>
  );
}
