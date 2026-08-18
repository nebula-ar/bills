"use client";

import "@/lib/icons";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { fetchMoreMenuStatsAction } from "@/modules/nav/more-menu-stats.actions";
import type { Nav, NavPrimary } from "@/lib/app-modules";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

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

// Versión clara del mismo color, para el pill del conteo debajo de la
// tarjeta: el cuadradito de arriba grita, el pill solo tiene que acompañar.
const TINT_PILLS: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-700",
  blue: "bg-primary/10 text-primary",
  violet: "bg-violet-50 text-violet-700",
  orange: "bg-orange-50 text-orange-700",
  rose: "bg-rose-50 text-rose-700",
  cyan: "bg-cyan-50 text-cyan-700",
  amber: "bg-amber-50 text-amber-700",
  indigo: "bg-indigo-50 text-indigo-700",
};

// Cómo se lee el número de cada tarjeta. Solo los módulos que
// `getMoreMenuStats` sabe contar aparecen acá; el resto (Sucursales, Staff,
// Configuración...) muestra la tarjeta sin pill, que es lo correcto: no todo
// atajo es "una cantidad de algo".
const STAT_LABELS: Record<string, (n: number) => string> = {
  "/salon": (n) => `${n} ${n === 1 ? "mesa" : "mesas"}`,
  "/cocina": (n) => `${n} en preparación`,
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

// Sin acentos y sin mayúsculas: mismo criterio que el buscador de la carta
// (comanda-catalog), para que "cocina" encuentre "Cocina" igual en todos
// lados.
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
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
  // null = todavía no se pidieron. Se piden UNA vez por sesión de página, al
  // primer toque en "Más": pedirlas en el layout raíz —que se renderiza en
  // cada navegación— sería siete conteos de más en cada click de la app.
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [search, setSearch] = useState("");

  const visibles = useMemo(() => {
    const query = normalize(search.trim());
    if (!query) return nav.more;
    return nav.more.filter(
      (item) => normalize(item.label).includes(query) || normalize(item.hint).includes(query),
    );
  }, [nav.more, search]);

  if (HIDDEN_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))) {
    return null;
  }

  const moreActive = nav.more.some((item) => isActive(pathname, item.href));

  function abrirMas() {
    setMoreOpen(true);
    if (stats !== null || loadingStats) return;

    setLoadingStats(true);
    fetchMoreMenuStatsAction(nav.more.map((item) => item.href))
      .then(setStats)
      .catch(() => setStats({}))
      .finally(() => setLoadingStats(false));
  }

  function cerrarMas() {
    setMoreOpen(false);
    setSearch("");
  }

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
          onClick={abrirMas}
          type="button"
        >
          <Icon className="size-5 shrink-0" icon="solar:menu-dots-bold" />
          <span className="max-w-full truncate">Más</span>
        </button>
      </nav>

      {/* `dialog` y no el sheet angosto: la grilla de dos columnas necesita el
          ancho extra en escritorio para no quedar apretada. */}
      <BottomSheet onClose={cerrarMas} open={moreOpen} size="dialog">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between px-5 pt-6">
            <h3 className="text-xl font-black tracking-tight text-slate-950">Todo el sistema</h3>
          </div>

          <div className="px-5 pt-4">
            <div className="relative">
              <Icon
                className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400"
                icon="solar:magnifer-linear"
              />
              <input
                aria-label="Buscar en el sistema"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar en el sistema..."
                value={search}
              />
            </div>
          </div>

          {/* Alto fijo, no "lo que ocupe el contenido": si el buscador deja 3
              tarjetas en vez de 15, el modal se achicaba con cada letra
              tipeada en vez de solo mostrar menos filas. */}
          <div className="h-[55dvh] overflow-y-auto px-5 pb-6 pt-4">
            {visibles.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">
                Nada con eso en el sistema.
              </p>
            ) : (
            /* 2 columnas en el celular (el sheet mide ~460px ahí), 4 desde
                `sm` —cuando `size="dialog"` lo ensancha a ~860px—: con 2 fijas
                en ese ancho cada tarjeta quedaba estirada, casi vacía. */
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {visibles.map((item) => {
                const active = isActive(pathname, item.href);
                const stat = stats?.[item.href];
                const statLabel = STAT_LABELS[item.href];

                return (
                  <Link
                    className={`flex flex-col gap-2 rounded-2xl border p-3 text-left transition active:scale-[0.98] ${
                      active ? "border-primary/30 bg-primary/5" : "border-slate-200 bg-white"
                    }`}
                    href={item.href}
                    key={item.href}
                    onClick={cerrarMas}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className={`grid size-10 shrink-0 place-items-center rounded-xl shadow-sm ${TINTS[item.tint]}`}>
                        <Icon className="size-5" icon={item.icon} />
                      </span>
                      <Icon className="size-3.5 shrink-0 text-slate-300" icon="solar:alt-arrow-right-linear" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-base font-black text-slate-950">{item.label}</p>
                      <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-slate-500">{item.hint}</p>
                    </div>

                    {statLabel ? (
                      loadingStats && stat === undefined ? (
                        <span className="h-6 w-24 animate-pulse rounded-full bg-slate-100" />
                      ) : stat !== undefined ? (
                        <span
                          className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-bold ${TINT_PILLS[item.tint]}`}
                        >
                          {statLabel(stat)}
                        </span>
                      ) : null
                    ) : null}
                  </Link>
                );
              })}
            </div>
            )}
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
