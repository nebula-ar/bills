"use client";

import "@/lib/icons";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = { href: string; label: string; icon: string };

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: "solar:home-2-bold" },
  { href: "/pos", label: "Vender", icon: "solar:bag-4-bold" },
  { href: "/sales", label: "Historial", icon: "solar:bill-list-bold" },
  { href: "/expenses", label: "Gastos", icon: "solar:wallet-bold" },
];

// Estilo "Ajustes de iOS": cuadradito de color sólido con el icono en blanco.
// Clases completas (Tailwind necesita verlas literales para no purgarlas).
const TINTS: Record<string, string> = {
  emerald: "bg-emerald-500 text-white",
  blue: "bg-blue-500 text-white",
  violet: "bg-violet-500 text-white",
  orange: "bg-orange-500 text-white",
  rose: "bg-rose-500 text-white",
};

// Los ABM (configuración) viven detrás de "Más" para no saturar la barra.
// Iconos del set Solar (vía Iconify), cada uno con su color.
const MORE_ITEMS: { href: string; label: string; icon: string; tint: string; hint: string }[] = [
  { href: "/caja", label: "Caja", icon: "solar:safe-2-bold", tint: "emerald", hint: "Saldos, transferencias y cierre de caja" },
  { href: "/terminals", label: "Terminales", icon: "solar:smartphone-bold", tint: "blue", hint: "Mostrador, teléfonos y propias" },
  { href: "/services", label: "Servicios", icon: "solar:scissors-bold", tint: "violet", hint: "Catálogo y precios por sucursal" },
  { href: "/barbers", label: "Barberos", icon: "solar:users-group-two-rounded-bold", tint: "orange", hint: "Alta, sucursal y PIN" },
  { href: "/branches", label: "Sucursales", icon: "solar:shop-2-bold", tint: "rose", hint: "Nombre, dirección y estado" },
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
              <Icon className="size-5 shrink-0" icon={item.icon} />
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
          <Icon className="size-5 shrink-0" icon="solar:menu-dots-bold" />
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
                  <span className={`flex size-11 shrink-0 items-center justify-center rounded-[0.7rem] shadow-sm ${TINTS[item.tint]}`}>
                    <Icon className="size-6" icon={item.icon} />
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
