import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonFAB, SkeletonList, SkeletonStage } from "@/components/skeleton-patterns";

// Skeleton de terminales: header + lista de terminales + FAB, mismo layout que
// /terminals.
export default function Loading() {
  return (
    <SkeletonStage>
      <main className="mx-auto min-h-dvh w-full min-w-0 max-w-[560px] bg-[var(--background)] px-4 pb-[calc(env(safe-area-inset-bottom)+7rem)] pt-6 lg:max-w-none lg:px-8">
        <header className="flex items-center justify-between gap-4">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-10 w-24 rounded-xl" />
        </header>

        <div className="mt-4">
          <SkeletonList avatar={false} rows={5} />
        </div>

        <SkeletonFAB />
      </main>
    </SkeletonStage>
  );
}
