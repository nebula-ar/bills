import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonAppShell, SkeletonPageHeader, SkeletonSectionCard, SkeletonStage } from "@/components/skeleton-patterns";

// Skeleton de marketing: header + tarjetas de secciones con filas de clientes,
// misma estructura que la página real.
export default function Loading() {
  return (
    <SkeletonStage>
      <SkeletonAppShell maxWidth="lg">
        <SkeletonPageHeader description={true} />
        <SkeletonSectionCard titleWidth="w-36">
          <div className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3.5" key={index}>
                <div className="min-w-0 space-y-2">
                  <Skeleton className="h-4 w-1/3 max-w-40" />
                  <Skeleton className="h-3 w-1/2 max-w-48" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </SkeletonSectionCard>
        <SkeletonSectionCard titleWidth="w-28">
          <div className="space-y-2.5">
            {Array.from({ length: 3 }).map((_, index) => (
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3.5" key={index}>
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3 max-w-36" />
                  <Skeleton className="h-3 w-1/2 max-w-44" />
                </div>
                <Skeleton className="h-6 w-14 rounded-full" />
              </div>
            ))}
          </div>
        </SkeletonSectionCard>
      </SkeletonAppShell>
    </SkeletonStage>
  );
}
