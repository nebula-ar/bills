import { SkeletonAppShell, SkeletonList, SkeletonPageHeader, SkeletonStage } from "@/components/skeleton-patterns";

// Skeleton global (fallback): lo muestra Next mientras las rutas que no tienen
// `loading.tsx` propio resuelven sus datos. Cada ruta principal define el suyo
// en `src/app/<ruta>/loading.tsx` espejando su layout real; este queda como
// silueta neutra (header + lista) para el resto.
export default function Loading() {
  return (
    <SkeletonStage>
      <SkeletonAppShell maxWidth="md">
        <SkeletonPageHeader />
        <SkeletonList rows={5} />
      </SkeletonAppShell>
    </SkeletonStage>
  );
}
