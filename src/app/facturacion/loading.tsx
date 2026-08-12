import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonStage } from "@/components/skeleton-patterns";

// Skeleton de facturación: header + tarjeta con los campos del perfil fiscal,
// mismo layout que /facturacion.
export default function Loading() {
  return (
    <SkeletonStage>
      <main className="mx-auto min-h-dvh w-full min-w-0 max-w-[560px] bg-[var(--background)] px-4 pb-[calc(env(safe-area-inset-bottom)+7rem)] pt-6 lg:max-w-[720px] lg:px-8">
        <header className="flex items-center justify-between gap-4">
          <div>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-2 h-7 w-40" />
          </div>
        </header>

        <div className="mt-4 space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-950/5">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="space-y-2" key={index}>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
          ))}
          <Skeleton className="h-11 w-40 rounded-xl" />
        </div>
      </main>
    </SkeletonStage>
  );
}
