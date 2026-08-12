import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonPanel, SkeletonStage } from "@/components/skeleton-patterns";

// Skeleton del dashboard: espeja el layout de ReportsView — header con saludar
// + dos botones redondos, chips de período, hero + 4 KPIs, paneles y última
// ventas — para que al resolver los datos el contenido caiga en su lugar sin
// saltos.
export default function Loading() {
  return (
    <SkeletonStage>
      <main className="mx-auto min-h-dvh w-full min-w-0 max-w-[560px] bg-[var(--background)] px-4 pb-[calc(env(safe-area-inset-bottom)+7rem)] pt-6 lg:max-w-none lg:px-8">
        {/* Header: saludo + botones redondos */}
        <header className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-2 h-7 w-32" />
          </div>
          <div className="flex shrink-0 gap-2">
            <Skeleton className="size-11 rounded-full" />
            <Skeleton className="size-11 rounded-full" />
          </div>
        </header>

        {/* Chips de período + filtro */}
        <div className="mt-5 flex items-center gap-2">
          <Skeleton className="h-9 w-16 rounded-full" />
          <Skeleton className="h-9 w-14 rounded-full" />
          <Skeleton className="h-9 w-14 rounded-full" />
          <Skeleton className="ml-auto size-10 rounded-full" />
        </div>

        {/* Hero + KPIs */}
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-12">
          <Skeleton className="h-44 rounded-3xl lg:col-span-7" />
          <div className="grid grid-cols-2 gap-3 lg:col-span-5 lg:content-start">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton className="h-24 rounded-2xl" key={index} />
            ))}
          </div>
        </div>

        {/* Paneles de análisis */}
        <div className="mt-4 space-y-3 lg:columns-2 lg:gap-4">
          <SkeletonPanel className="h-52">
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </SkeletonPanel>
          <SkeletonPanel className="h-64">
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          </SkeletonPanel>
          <SkeletonPanel className="h-48">
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </SkeletonPanel>
        </div>

        {/* Últimas ventas */}
        <div className="mt-4 mb-4 space-y-3">
          <Skeleton className="h-5 w-32" />
          <SkeletonPanel className="p-0">
            {Array.from({ length: 4 }).map((_, index) => (
              <div className="flex items-center gap-3 px-4 py-3" key={index}>
                <Skeleton className="size-11 shrink-0 rounded-2xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3 max-w-40" />
                  <Skeleton className="h-3 w-2/3 max-w-56" />
                </div>
                <Skeleton className="h-5 w-16 shrink-0" />
              </div>
            ))}
          </SkeletonPanel>
        </div>
      </main>
    </SkeletonStage>
  );
}
