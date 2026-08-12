import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonChips, SkeletonFAB, SkeletonList, SkeletonSearchBar, SkeletonStage } from "@/components/skeleton-patterns";

// Skeleton del catálogo: header con botón "nuevo", buscador, chips de filtro y
// grilla de productos, mismo layout que /catalog.
export default function Loading() {
  return (
    <SkeletonStage>
      <main className="mx-auto min-h-dvh w-full min-w-0 max-w-[560px] bg-[var(--background)] px-4 pb-[calc(env(safe-area-inset-bottom)+7rem)] pt-6 lg:max-w-none lg:px-8">
        <header className="flex items-center justify-between gap-4">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-10 w-24 rounded-xl" />
        </header>

        <SkeletonSearchBar className="mt-4" />
        <SkeletonChips className="mt-3" />

        <div className="mt-4">
          <SkeletonList avatar={true} rows={7} />
        </div>

        <SkeletonFAB />
      </main>
    </SkeletonStage>
  );
}
