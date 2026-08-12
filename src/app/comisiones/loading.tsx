import { SkeletonListPage } from "@/components/skeleton-patterns";

export default function Loading() {
  return <SkeletonListPage maxWidth="lg" rows={6} avatar={false} />;
}
