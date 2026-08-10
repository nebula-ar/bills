"use client";

import "@/lib/icons";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import type { Nav, NavPrimary } from "@/lib/app-modules";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

// Estilo "Ajustes de iOS": cuadradito de color sólido con el icono en blanco.
// Clases completas (Tailwind necesita verlas literales para no purgarlas).
const TINTS: Record<string, string> = {
  emerald: "bg-emerald-500 text-white",
  blue: "bg-primary text-white",
  violet: "bg-violet-500 text-white",
  orange: "bg-orange-500 text-white",
  rose: "bg-rose-500 text-white",
  cyan: "bg-cyan-500 text-white",
  amber: "bg-amber-500 text-white",
  indigo: "bg-indigo-500 text-white",
};

// Rutas donde NO se muestra la nav admin: el login, la terminal del empleado
// (que tiene la suya) y el desvío de entrada.
//
// En /entrar la nav se contradice con la pantalla: se pregunta a dónde va y
// abajo hay un atajo para ir igual. Y encima "Vender" quedaba dos veces, una
// como tarjeta y otra en la barra.
const HIDDEN_PREFIXES = ["/login", "/terminal", "/entrar"];

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return matchesPrefix(pathname, href);
}

// Igual que `isActive`, pero respetando los ajustes del ítem: `exact` evita que
// una sección se marque desde sus rutas hijas y `alsoMatches` suma rutas que
// conceptualmente pertenecen al ítem aunque cuelguen de otro path.
function isPrimaryActive(pathname: string, item: NavPrimary) {
  if (item.alsoMatches?.some((prefix) => matchesPrefix(pathname, prefix))) {
    return true;
  }

  if (item.exact) {
    return pathname === item.href;
  }

  return isActive(pathname, item.href);
}

// La navegación llega armada desde el servidor (ver buildNav): depende de los
// módulos que el negocio tenga prendidos y del vocabulario de su rubro. Una
// barbería no ve "Proveedores" y un kiosco no ve "Comisiones".
export function MobileNav({ nav }: { nav: Nav }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  if (HIDDEN_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))) {
    return null;
  }

  const moreActive = nav.more.some((item) => isActive(pathname, item.href));

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto grid max-w-[560px] grid-cols-5 border-t border-slate-200 bg-white/90 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-lg sm:bottom-4 sm:rounded-3xl sm:border sm:px-3 sm:pb-2">
        {nav.primary.map((item) => {
          const active = isPrimaryActive(pathname, item);
          return (
            <Link
              className={`flex min-w-0 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[0.62rem] font-bold transition active:scale-95 ${
                active ? "bg-primary/10 text-primary" : "text-slate-500"
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
            moreActive || moreOpen ? "bg-primary/10 text-primary" : "text-slate-500"
          }`}
          onClick={() => setMoreOpen(true)}
          type="button"
        >
          <Icon className="size-5 shrink-0" icon="solar:menu-dots-bold" />
          <span className="max-w-full truncate">Más</span>
        </button>
      </nav>

      {/* `dialog` y no el sheet angosto: en escritorio la lista de módulos entra
          de un vistazo en vez de pedir scroll, y los hints dejan de cortarse. */}
      <BottomSheet onClose={() => setMoreOpen(false)} open={moreOpen} size="dialog">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between px-5 pt-6">
            <h3 className="text-xl font-black tracking-tight text-slate-950">Todo el sistema</h3>
          </div>
          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-5 pb-6 pt-4">
            {nav.more.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  className={`flex items-center gap-3 rounded-2xl p-3.5 transition active:scale-[0.99] ${
                    active ? "bg-primary/10 ring-1 ring-primary/20" : "bg-slate-50"
                  }`}
                  href={item.href}
                  key={item.href}
                  onClick={() => setMoreOpen(false)}
                >
                  <span className={`flex size-11 shrink-0 items-center justify-center rounded-lg shadow-sm ${TINTS[item.tint]}`}>
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
