import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonAppShell, SkeletonPageHeader, SkeletonSectionCard, SkeletonStage } from "@/components/skeleton-patterns";

// Skeleton de producción: header + formulario de tanda + tarjetas de receta,
// misma estructura que la página real.
export default function Loading() {
  return (
    <SkeletonStage>
      <SkeletonAppShell maxWidth="md">
        <SkeletonPageHeader description={true} />
        <SkeletonSectionCard titleWidth="w-36">
          <div className="flex flex-wrap items-end gap-3">
            {Array.from({ length: 2 }).map((_, index) => (
              <div className="min-w-[10rem] flex-1 space-y-2" key={index}>
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
            ))}
            <Skeleton className="h-11 w-28 rounded-xl" />
          </div>
        </SkeletonSectionCard>
        <SkeletonSectionCard titleWidth="w-40">
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index}>
                <Skeleton className="h-4 w-1/3 max-w-44" />
                <div className="mt-2 flex flex-wrap gap-2">
                  {Array.from({ length: 3 }).map((__, chip) => (
                    <Skeleton className="h-6 w-20 rounded-full" key={chip} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SkeletonSectionCard>
      </SkeletonAppShell>
    </SkeletonStage>
  );
}
