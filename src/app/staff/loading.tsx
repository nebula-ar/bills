import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonFAB, SkeletonList, SkeletonSearchBar, SkeletonStage } from "@/components/skeleton-patterns";

// Skeleton del personal: header + buscador + lista de empleados + FAB, mismo
// layout que /staff.
export default function Loading() {
  return (
    <SkeletonStage>
      <main className="mx-auto min-h-dvh w-full min-w-0 max-w-[560px] bg-[var(--background)] px-4 pb-[calc(env(safe-area-inset-bottom)+7rem)] pt-6 lg:max-w-none lg:px-8">
        <header className="flex items-center justify-between gap-4">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-10 w-24 rounded-xl" />
        </header>

        <SkeletonSearchBar className="mt-4" />

        <div className="mt-4">
          <SkeletonList avatar={true} rows={6} />
        </div>

        <SkeletonFAB />
      </main>
    </SkeletonStage>
  );
}
