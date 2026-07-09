import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { FlashToaster } from "@/components/flash-toaster";
import { MobileNav } from "@/components/mobile-nav";
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

// Permitimos el zoom del usuario (accesibilidad, WCAG 1.4.4). El doble-tap-zoom
// accidental ya se evita con `touch-action: manipulation` en el CSS global, así
// que dejar pellizcar para acercar no desconfigura la vista tipo POS.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
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
      <body className="min-h-full flex flex-col bg-[#f6f7fb]">
        {children}
        {showNav ? <MobileNav /> : null}
        <Toaster position="top-center" richColors toastOptions={{ className: "font-semibold" }} />
        <Suspense fallback={null}>
          <FlashToaster />
        </Suspense>
      </body>
    </html>
  );
}
