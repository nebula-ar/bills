import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonAppShell, SkeletonPageHeader, SkeletonStage } from "@/components/skeleton-patterns";

// Skeleton de mermas: header + formulario + lista de mermas (producto,
// cantidad, costo, motivo, fecha), misma estructura que la página real.
export default function Loading() {
  return (
    <SkeletonStage>
      <SkeletonAppShell maxWidth="md">
        <SkeletonPageHeader description={true} />
        <div className="flex flex-wrap items-end gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          {Array.from({ length: 3 }).map((_, index) => (
            <div className="min-w-[10rem] flex-1 space-y-2" key={index}>
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
          ))}
          <Skeleton className="h-11 w-28 rounded-xl" />
        </div>
        <ul className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <li className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3" key={index}>
              <Skeleton className="h-4 w-1/3 max-w-40" />
              <Skeleton className="h-4 w-14" />
              <Skeleton className="ml-auto h-4 w-16" />
              <Skeleton className="h-3 w-full max-w-60" />
              <Skeleton className="h-3 w-20" />
            </li>
          ))}
        </ul>
      </SkeletonAppShell>
    </SkeletonStage>
  );
}
