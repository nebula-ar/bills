"use client";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  HomeIcon,
  MonitorSmartphone,
  MoreHorizontal,
  ReceiptText,
  Scissors,
  ShoppingBag,
  Store,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = { href: string; label: string; icon: LucideIcon };

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: HomeIcon },
  { href: "/pos", label: "Vender", icon: ShoppingBag },
  { href: "/sales", label: "Historial", icon: ReceiptText },
  { href: "/expenses", label: "Gastos", icon: Wallet },
];

// Los ABM (configuración) viven detrás de "Más" para no saturar la barra.
const MORE_ITEMS: (NavItem & { hint: string })[] = [
  { href: "/terminals", label: "Terminales", icon: MonitorSmartphone, hint: "Mostrador, teléfonos y propias" },
  { href: "/services", label: "Servicios", icon: Scissors, hint: "Catálogo y precios por sucursal" },
  { href: "/barbers", label: "Barberos", icon: Users, hint: "Alta, sucursal y PIN" },
  { href: "/branches", label: "Sucursales", icon: Store, hint: "Nombre, dirección y estado" },
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
  const [moreOpen, setMoreOpen] = useState(false);

  if (HIDDEN_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))) {
    return null;
  }

  const moreActive = MORE_ITEMS.some((item) => isActive(pathname, item.href));

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto grid max-w-[560px] grid-cols-5 border-t border-slate-200 bg-white/90 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-lg sm:bottom-4 sm:rounded-[1.75rem] sm:border sm:px-3 sm:pb-2">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              className={`flex min-w-0 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[0.62rem] font-bold transition active:scale-95 ${
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
        <button
          className={`flex min-w-0 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[0.62rem] font-bold transition active:scale-95 ${
            moreActive || moreOpen ? "bg-blue-50 text-blue-700" : "text-slate-500"
          }`}
          onClick={() => setMoreOpen(true)}
          type="button"
        >
          <MoreHorizontal className="size-4 shrink-0" />
          <span className="max-w-full truncate">Más</span>
        </button>
      </nav>

      <BottomSheet onClose={() => setMoreOpen(false)} open={moreOpen}>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between px-5 pt-6">
            <h3 className="text-xl font-black tracking-tight text-slate-950">Configuración</h3>
          </div>
          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-5 pb-6 pt-4">
            {MORE_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  className={`flex items-center gap-3 rounded-2xl p-3.5 transition active:scale-[0.99] ${
                    active ? "bg-blue-50 ring-1 ring-blue-200" : "bg-slate-50"
                  }`}
                  href={item.href}
                  key={item.href}
                  onClick={() => setMoreOpen(false)}
                >
                  <span
                    className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${
                      active ? "bg-blue-600 text-white" : "bg-white text-blue-600 ring-1 ring-slate-950/5"
                    }`}
                  >
                    <item.icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-slate-950">{item.label}</p>
                    <p className="truncate text-xs text-slate-500">{item.hint}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
