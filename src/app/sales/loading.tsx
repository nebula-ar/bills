import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonFAB, SkeletonList, SkeletonStage } from "@/components/skeleton-patterns";

// Skeleton del historial de ventas: header + barra de resumen + lista de
// ventas + FAB, mismo layout que /sales.
export default function Loading() {
  return (
    <SkeletonStage>
      <main className="mx-auto min-h-dvh w-full min-w-0 max-w-[560px] bg-[var(--background)] px-4 pb-[calc(env(safe-area-inset-bottom)+7rem)] pt-6 lg:max-w-none lg:px-8">
        <header className="flex items-center justify-between gap-4">
          <div>
            <Skeleton className="h-4 w-16" />
            <Skeleton className="mt-2 h-7 w-28" />
          </div>
        </header>

        {/* Barra de resumen del período */}
        <Skeleton className="mt-4 h-20 rounded-2xl" />

        {/* Lista de ventas */}
        <div className="mt-4">
          <SkeletonList avatar={true} rows={6} />
        </div>

        <SkeletonFAB />
      </main>
    </SkeletonStage>
  );
}
