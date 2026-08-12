import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonAppShell, SkeletonPageHeader, SkeletonSectionCard, SkeletonStage } from "@/components/skeleton-patterns";

// Skeleton de configuración: header + tarjeta de módulos con sus filas (icono,
// nombre, hint, switch), misma estructura que la página real.
export default function Loading() {
  return (
    <SkeletonStage>
      <SkeletonAppShell maxWidth="lg">
        <SkeletonPageHeader description={false} />
        <SkeletonSectionCard titleWidth="w-44">
          <ul className="space-y-2.5">
            {Array.from({ length: 5 }).map((_, index) => (
              <li className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3.5" key={index}>
                <Skeleton className="size-11 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3 max-w-36" />
                  <Skeleton className="h-3 w-2/3 max-w-52" />
                </div>
                <Skeleton className="h-6 w-10 shrink-0 rounded-full" />
              </li>
            ))}
          </ul>
        </SkeletonSectionCard>
      </SkeletonAppShell>
    </SkeletonStage>
  );
}
