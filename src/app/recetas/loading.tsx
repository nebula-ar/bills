import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonAppShell, SkeletonPageHeader, SkeletonSectionCard, SkeletonStage } from "@/components/skeleton-patterns";

// Skeleton de recetas: header + selector + tabla de insumos por producto,
// misma estructura que la página real.
export default function Loading() {
  return (
    <SkeletonStage>
      <SkeletonAppShell maxWidth="full">
        <SkeletonPageHeader description={true} />
        <SkeletonSectionCard titleWidth="w-36">
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div className="space-y-2" key={index}>
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
            ))}
          </div>
          <div className="mt-5 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-950/5">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 text-left">
                  {["Insumo", "Cantidad", "Costo", "%"].map((col) => (
                    <th className="px-4 py-3 text-xs font-bold text-slate-400" key={col}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, index) => (
                  <tr className="border-b border-slate-50 last:border-0" key={index}>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-32" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-12" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-16" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-10" />
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
