import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonAppShell, SkeletonList, SkeletonPageHeader, SkeletonStage, SkeletonStatCard } from "@/components/skeleton-patterns";

// Skeleton de stock: header + aviso + tiles de métricas + lista de productos.
export default function Loading() {
  return (
    <SkeletonStage>
      <SkeletonAppShell maxWidth="lg">
        <SkeletonPageHeader description={true} />
        <Skeleton className="h-12 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonStatCard key={index} />
          ))}
        </div>
        <SkeletonList avatar={false} rows={5} />
      </SkeletonAppShell>
    </SkeletonStage>
  );
}
