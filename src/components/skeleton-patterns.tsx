import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// ─────────────────────────────────────────────────────────────────────────────
// Patrones de skeleton compartidos (NEBU-37).
//
// Cada pantalla de gestión arma su `loading.tsx` con estos bloques para que el
// skeleton espeje el layout REAL de la página — header, tarjetas, filas — en
// vez de mostrar la silueta del dashboard en todas las rutas.
//
// Convenciones: los contenedores (tarjetas, filas) replican los estilos de los
// componentes reales (bg-white, rounded-2xl, ring-slate-950/5) y los bloques
// placeholder usan <Skeleton> (token + shimmer). Así el esqueleto se parece al
// contenido que va a aparecer y el cambio skeleton → contenido no salta.
// ─────────────────────────────────────────────────────────────────────────────

// Envuelve el loading: entrada suave (fade 150ms) del propio skeleton para que
// no aparezca de golpe al navegar. El fade del CONTENIDO real lo ponen los
// mains de cada pantalla (AppShell y managers), a 300ms.
export function SkeletonStage({ children }: { children: ReactNode }) {
  return <div className="duration-150 animate-in fade-in">{children}</div>;
}

// Réplica del shell de AppShell para que el skeleton ocupe exactamente el
// mismo espacio (márgenes, paddings, ancho máx.) que la página real.
const shellMaxWidth: Record<string, string> = {
  sm: "max-w-xl",
  md: "max-w-3xl",
  lg: "max-w-5xl",
  xl: "max-w-6xl",
  full: "max-w-none",
};

export function SkeletonAppShell({
  children,
  maxWidth = "md",
}: {
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
}) {
  return (
    <main className="min-h-dvh px-4 pb-[calc(env(safe-area-inset-bottom)+10rem)] pt-5 text-slate-950 sm:px-6 sm:pb-[calc(env(safe-area-inset-bottom)+10rem)] sm:pt-10">
      <section className={cn("mx-auto flex w-full flex-col gap-6", shellMaxWidth[maxWidth])}>{children}</section>
    </main>
  );
}

// Header de página: eyebrow + título + (descripción) + (botón de acción).
export function SkeletonPageHeader({
  description = true,
  withActions = true,
}: {
  description?: boolean;
  withActions?: boolean;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="w-full max-w-2xl">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="mt-3 h-8 w-52 max-w-full sm:h-9" />
        {description ? <Skeleton className="mt-3 h-4 w-full max-w-md" /> : null}
      </div>
      {withActions ? <Skeleton className="h-10 w-28 shrink-0 rounded-xl" /> : null}
    </header>
  );
}

// Tarjeta de métrica chica (KPIs): label + valor.
export function SkeletonStatCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-950/5", className)}>
      <Skeleton className="h-3 w-16" />
      <Skeleton className="mt-2 h-6 w-24" />
    </div>
  );
}

// Panel de contenido: título con icono + hijos skeleton.
export function SkeletonPanel({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <div className={cn("rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-950/5", className)}>
      <div className="flex items-center gap-2">
        <Skeleton className="size-4 rounded-full" />
        <Skeleton className="h-4 w-32" />
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

// Réplica de SectionCard (manager-ui): tarjeta con título + descripción +
// contenido, con bloques placeholder en las posiciones del componente real.
export function SkeletonSectionCard({
  children,
  className,
  description = true,
  titleWidth = "w-40",
}: {
  children?: ReactNode;
  className?: string;
  description?: boolean;
  titleWidth?: string;
}) {
  return (
    <section className={cn("rounded-3xl border border-slate-200 bg-white p-5 shadow-sm", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Skeleton className={cn("h-5", titleWidth)} />
          {description ? <Skeleton className="mt-2 h-3 w-full max-w-sm" /> : null}
        </div>
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

// Fila de lista/catálogo: avatar/icono + dos líneas + importe a la derecha.
export function SkeletonRow({ avatar = true }: { avatar?: boolean }) {
  return (
    <div className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-950/5">
      {avatar ? <Skeleton className="size-11 shrink-0 rounded-2xl" /> : null}
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3 max-w-44" />
        <Skeleton className="h-3 w-2/3 max-w-60" />
      </div>
      <Skeleton className="h-5 w-16 shrink-0" />
    </div>
  );
}

export function SkeletonList({ avatar = true, rows = 5 }: { avatar?: boolean; rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonRow avatar={avatar} key={index} />
      ))}
    </div>
  );
}

// Chips de filtro / períodos.
export function SkeletonChips({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton className={cn("h-9 rounded-full", index === 0 ? "w-20" : "w-16")} key={index} />
      ))}
    </div>
  );
}

// Barra de búsqueda.
export function SkeletonSearchBar({ className }: { className?: string }) {
  return <Skeleton className={cn("h-11 rounded-xl", className)} />;
}

// Botón flotante de acción (FAB).
export function SkeletonFAB() {
  return <Skeleton className="fixed bottom-[96px] right-4 z-40 size-14 rounded-full md:bottom-8 md:right-8" />;
}

// Página de gestión estándar (AppShell + header + lista): el caso más común.
export function SkeletonListPage({
  avatar = true,
  description = true,
  maxWidth = "lg",
  rows = 6,
}: {
  avatar?: boolean;
  description?: boolean;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
  rows?: number;
}) {
  return (
    <SkeletonStage>
      <SkeletonAppShell maxWidth={maxWidth}>
        <SkeletonPageHeader description={description} />
        <SkeletonList avatar={avatar} rows={rows} />
      </SkeletonAppShell>
    </SkeletonStage>
  );
}
