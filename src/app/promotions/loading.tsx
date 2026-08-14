import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonAppShell, SkeletonPageHeader, SkeletonSectionCard, SkeletonStage } from "@/components/skeleton-patterns";

// Skeleton de promociones: header + tarjetas de promo (nombre, regla, vigencia
// y acciones), misma estructura que la página real.
export default function Loading() {
  return (
    <SkeletonStage>
      <SkeletonAppShell maxWidth="lg">
        <SkeletonPageHeader description={true} />
        <SkeletonSectionCard titleWidth="w-40">
          <ul className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <li className="rounded-2xl border border-slate-200 p-4" key={index}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <Skeleton className="h-4 w-1/3 max-w-40" />
                    <Skeleton className="h-4 w-2/3 max-w-56" />
                    <Skeleton className="h-3 w-1/2 max-w-44" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-9 w-16 rounded-xl" />
                    <Skeleton className="h-9 w-16 rounded-xl" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </SkeletonSectionCard>
      </SkeletonAppShell>
    </SkeletonStage>
  );
}
