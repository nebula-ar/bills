import { Skeleton } from "@/components/ui/skeleton";
import { StatTilesSkeleton } from "@/components/stat-tiles";
import { SkeletonAppShell, SkeletonPageHeader, SkeletonSectionCard, SkeletonStage } from "@/components/skeleton-patterns";

// Skeleton de comisiones: header + navegador de mes + tiles reales + tabla de
// liquidación, misma estructura que la página real.
export default function Loading() {
  return (
    <SkeletonStage>
      <SkeletonAppShell maxWidth="lg">
        <SkeletonPageHeader description={false} />
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-20 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-16 rounded-xl" />
        </div>
        <StatTilesSkeleton />
        <SkeletonSectionCard titleWidth="w-44">
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-950/5">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 text-left">
                  {["Empleado", "Ventas", "Vendió", "%", "Comisión"].map((col) => (
                    <th className="px-4 py-3 text-xs font-bold text-slate-400" key={col}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, index) => (
                  <tr className="border-b border-slate-50 last:border-0" key={index}>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-28" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-8" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-16" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-5 w-12 rounded-full" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-20" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SkeletonSectionCard>
      </SkeletonAppShell>
    </SkeletonStage>
  );
}
