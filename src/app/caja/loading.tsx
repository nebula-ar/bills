import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonChips, SkeletonPanel, SkeletonStage, SkeletonStatCard } from "@/components/skeleton-patterns";

// Skeleton de caja: header + chips de sucursal + hero de saldo + mini KPIs +
// paneles de cuenta, mismo layout que /caja.
export default function Loading() {
  return (
    <SkeletonStage>
      <main className="mx-auto min-h-dvh w-full min-w-0 max-w-[560px] bg-[var(--background)] px-4 pb-[calc(env(safe-area-inset-bottom)+7rem)] pt-6 lg:max-w-none lg:px-8">
        <header className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-2 h-7 w-24" />
          </div>
        </header>

        <SkeletonChips className="mt-4" />

        {/* Hero: saldo total */}
        <Skeleton className="mt-4 h-32 rounded-2xl" />

        {/* Mini KPIs */}
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {Array.from({ length: 3 }).map((_, index) => (
            <SkeletonStatCard key={index} />
          ))}
        </div>

        {/* Cuentas */}
        <div className="mt-4 space-y-3 lg:columns-2 lg:gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <SkeletonPanel key={index}>
              <div className="space-y-2.5">
                {Array.from({ length: 3 }).map((__, rowIndex) => (
                  <div className="rounded-2xl bg-slate-50 p-3" key={rowIndex}>
                    <div className="flex items-center justify-between gap-3">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <div className="mt-1.5 flex items-center gap-3">
                      <Skeleton className="h-3 w-12" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  </div>
                ))}
              </div>
            </SkeletonPanel>
          ))}
        </div>
      </main>
    </SkeletonStage>
  );
}
