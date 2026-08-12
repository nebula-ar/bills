import { Skeleton } from "@/components/ui/skeleton";
import { SalesListSkeleton } from "@/components/sales-list";
import { SalesSummaryBarSkeleton } from "@/components/sales-summary-bar";
import { SkeletonStage } from "@/components/skeleton-patterns";

// Skeleton del historial de ventas: header + barra de resumen + lista (tabla
// en escritorio, tarjetas en mobile), los skeletons reales de cada componente.
export default function Loading() {
  return (
    <SkeletonStage>
      <main className="mx-auto min-h-dvh w-full min-w-0 max-w-[560px] bg-[var(--background)] px-4 pb-[calc(env(safe-area-inset-bottom)+7rem)] pt-6 lg:max-w-none lg:px-8">
        <header className="flex items-center justify-between gap-4">
          <div>
            <Skeleton className="h-4 w-16" />
            <Skeleton className="mt-2 h-7 w-28" />
          </div>
        </header>

        <SalesSummaryBarSkeleton />
        <SalesListSkeleton />
      </main>
    </SkeletonStage>
  );
}
