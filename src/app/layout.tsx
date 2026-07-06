import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
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
        {children}
        {showNav ? <MobileNav /> : null}
      </body>
    </html>
  );
}
