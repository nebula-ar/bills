import { SkeletonListPage } from "@/components/skeleton-patterns";

export default function Loading() {
  return <SkeletonListPage maxWidth="lg" rows={4} avatar={false} />;
}
