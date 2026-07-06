import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { MobileNav } from "@/components/mobile-nav";
import { NoZoom } from "@/components/no-zoom";
import { getCurrentSession, isAdminRole } from "@/lib/auth";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Barber Bills",
  description: "Administración de ventas para barberías",
};

// App tipo POS: bloqueamos el zoom para que no se desconfigure la vista al tocar.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getCurrentSession();
  const showNav = isAdminRole(session?.user.role);

  return (
    <html
      lang="es-AR"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NoZoom />
        {children}
        {showNav ? <MobileNav /> : null}
      </body>
    </html>
  );
}
