import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonAppShell, SkeletonPageHeader, SkeletonSectionCard, SkeletonStage } from "@/components/skeleton-patterns";

// Skeleton de opciones: header + tarjetas de grupo de modificadores con sus
// filas de opciones, misma estructura que la página real.
export default function Loading() {
  return (
    <SkeletonStage>
      <SkeletonAppShell maxWidth="md">
        <SkeletonPageHeader description={false} />
        <SkeletonSectionCard titleWidth="w-44">
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index}>
                <div className="flex items-baseline justify-between gap-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <ul className="mt-2 flex flex-col gap-2">
                  {Array.from({ length: 3 }).map((__, row) => (
                    <li className="flex items-center gap-3 rounded-xl bg-slate-50 p-3" key={row}>
                      <Skeleton className="h-4 w-1/3 max-w-36" />
                      <Skeleton className="ml-auto h-4 w-12" />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </SkeletonSectionCard>
      </SkeletonAppShell>
    </SkeletonStage>
  );
}
