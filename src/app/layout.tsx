import type { Metadata, Viewport } from "next";
import { Baloo_2, Funnel_Sans, Geist_Mono, Inter, Montserrat, Nunito } from "next/font/google";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { FlashToaster } from "@/components/flash-toaster";
import { InstallPrompt } from "@/components/install-prompt";
import { MobileNav } from "@/components/mobile-nav";
import { capabilitiesOf } from "@/lib/capabilities";
import { buildNav } from "@/lib/app-modules";
import { verticalPreset } from "@/lib/vertical";
import { getCurrentSession, usesAppNav } from "@/lib/auth";
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

// Tipografía de la gastronomía: redondeada y cálida. Es la mitad de la
// identidad de un rubro — con Inter, por más rosa que esté, se lee como una
// app de banco. Se cargan siempre porque next/font las sirve desde el mismo
// dominio y solo pesan cuando el rubro las usa.
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

// La del login nuevo. Convive con las de arriba: cada una entra por su propia
// variable y el rubro elige cuál usa, así que sumar una no le saca la suya a
// nadie.
const funnelSans = Funnel_Sans({
  variable: "--font-funnel-sans",
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

// Zoom deshabilitado por decisión de producto: en el mostrador se cobra con una
// mano y el pellizco accidental descuadraba la vista, que es la pantalla con la
// que se factura. Se sacrifica WCAG 1.4.4 a conciencia.
//
// Dos cosas a saber antes de tocar esto: iOS Safari IGNORA `userScalable: false`
// para el pellizco desde la versión 10, así que ahí el zoom manual va a seguir
// andando. Y el salto automático al enfocar un campo NO se arregla acá: iOS lo
// hace con cualquier input de menos de 16px, y se resuelve en el CSS del input.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#3158e8",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getCurrentSession();
  // Los roles operativos (mozo, cocinero, cajero, encargado) también navegan
  // la app; el empleado de mostrador sigue trabajando por terminal.
  const showNav = usesAppNav(session?.user.role);

  // La navegación depende del negocio (rubro + módulos prendidos), así que se
  // arma acá con los datos ya resueltos y viaja al cliente lista para pintar.
  const business = showNav && session ? await findBusinessContext(session.user.businessId) : null;
  const nav = business
    ? buildNav(
        business.labels,
        business.modules,
        verticalPreset(business.vertical).catalogIcon,
        capabilitiesOf(session?.user.role),
      )
    : null;

  return (
    <html
      lang="es-AR"
      // El rubro pinta la app entera: los componentes usan ranuras semánticas
      // y el bloque [data-vertical] de globals.css las redefine. Sin esto el
      // bloque existe pero nunca aplica.
      data-vertical={business?.vertical}
      className={`${inter.variable} ${geistMono.variable} ${montserrat.variable} ${nunito.variable} ${baloo.variable} ${funnelSans.variable} h-full antialiased`}
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
