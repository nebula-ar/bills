import { Skeleton } from "@/components/ui/skeleton";
import { StatTilesSkeleton } from "@/components/stat-tiles";
import { StockManagerSkeleton } from "@/components/stock-manager";
import { SkeletonAppShell, SkeletonPageHeader, SkeletonStage } from "@/components/skeleton-patterns";

// Skeleton de stock: header + aviso + tiles reales (StatTilesSkeleton) + el
// estado skeleton real de StockManager (pestañas, buscador, filas).
export default function Loading() {
  return (
    <SkeletonStage>
      <SkeletonAppShell maxWidth="lg">
        <SkeletonPageHeader description={true} />
        <Skeleton className="h-12 rounded-2xl" />
        <StatTilesSkeleton />
        <StockManagerSkeleton />
      </SkeletonAppShell>
    </SkeletonStage>
  );
}
