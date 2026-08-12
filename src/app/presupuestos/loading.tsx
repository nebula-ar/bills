import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonAppShell, SkeletonPageHeader, SkeletonStage } from "@/components/skeleton-patterns";

// Skeleton de presupuestos: header + botón + tarjetas de presupuesto (número,
// badge, cliente, validez e ítems), misma estructura que la página real.
export default function Loading() {
  return (
    <SkeletonStage>
      <SkeletonAppShell maxWidth="lg">
        <SkeletonPageHeader description={true} />
        <ul className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, index) => (
            <li className="rounded-2xl border border-slate-200 p-3.5" key={index}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Skeleton className="h-5 w-12" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="mt-2 h-4 w-1/3 max-w-40" />
                  <Skeleton className="mt-1.5 h-3 w-2/3 max-w-56" />
                  <div className="mt-2 space-y-1.5">
                    <Skeleton className="h-3 w-48" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Skeleton className="h-9 w-20 rounded-xl" />
                  <Skeleton className="h-5 w-14" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </SkeletonAppShell>
    </SkeletonStage>
  );
}
