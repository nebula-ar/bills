"use client";

import { HomeIcon, ReceiptText, Scissors, ShoppingBag, Store, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Inicio", icon: HomeIcon },
  { href: "/pos", label: "Vender", icon: ShoppingBag },
  { href: "/sales", label: "Historial", icon: ReceiptText },
  { href: "/expenses", label: "Gastos", icon: Wallet },
  { href: "/services", label: "Servicios", icon: Scissors },
  { href: "/barbers", label: "Barberos", icon: Users },
  { href: "/branches", label: "Sucursales", icon: Store },
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
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto grid max-w-[560px] grid-cols-7 border-t border-slate-200 bg-white/90 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-lg md:hidden">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            className={`flex min-w-0 flex-col items-center gap-1 rounded-2xl px-0.5 py-2 text-[0.58rem] font-bold transition active:scale-95 ${
              active ? "bg-blue-50 text-blue-700" : "text-slate-500"
            }`}
            href={item.href}
            key={item.href}
          >
            <item.icon className="size-4 shrink-0" />
            <span className="max-w-full truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
