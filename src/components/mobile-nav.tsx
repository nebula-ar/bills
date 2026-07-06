"use client";

import { BarChart3, HomeIcon, MoreHorizontal, ReceiptText, Scissors } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Inicio", icon: HomeIcon },
  { href: "/reports", label: "Reportes", icon: BarChart3 },
  { href: "/sales", label: "Ventas", icon: ReceiptText },
  { href: "/services", label: "Servicios", icon: Scissors },
  { href: "/barbers", label: "Más", icon: MoreHorizontal },
];

// Rutas donde NO se muestra la nav admin (login y la terminal de barbero, que tiene la suya).
const HIDDEN_PREFIXES = ["/login", "/barber"];

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return matchesPrefix(pathname, href);
}

export function MobileNav() {
  const pathname = usePathname();

  if (HIDDEN_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))) {
    return null;
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto grid max-w-[460px] grid-cols-5 border-t border-slate-200 bg-white/90 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-lg md:hidden">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            className={`flex flex-col items-center gap-1 rounded-2xl px-1.5 py-2 text-[0.68rem] font-bold transition active:scale-95 ${
              active ? "bg-blue-50 text-blue-700" : "text-slate-500"
            }`}
            href={item.href}
            key={item.href}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
