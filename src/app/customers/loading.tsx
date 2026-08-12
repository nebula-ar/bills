import { Skeleton } from "@/components/ui/skeleton";
import { StatTilesSkeleton } from "@/components/stat-tiles";
import { SkeletonAppShell, SkeletonPageHeader, SkeletonSectionCard, SkeletonStage } from "@/components/skeleton-patterns";

// Skeleton de clientes: header + tiles reales + tabla de clientes y tarjeta de
// alta, misma estructura que la página real.
export default function Loading() {
  return (
    <SkeletonStage>
      <SkeletonAppShell maxWidth="lg">
        <SkeletonPageHeader description={true} />
        <StatTilesSkeleton />

        <SkeletonSectionCard titleWidth="w-32">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div className="flex items-center gap-3 border-t border-slate-100 pt-3 first:border-0 first:pt-0" key={index}>
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3 max-w-44" />
                  <Skeleton className="h-3 w-1/2 max-w-40" />
                </div>
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </SkeletonSectionCard>

        <SkeletonSectionCard titleWidth="w-32" description={false}>
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div className="space-y-2" key={index}>
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
            ))}
            <Skeleton className="h-11 w-40 rounded-xl sm:col-span-2" />
          </div>
        </SkeletonSectionCard>
      </SkeletonAppShell>
    </SkeletonStage>
  );
}
