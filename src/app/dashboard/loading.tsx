import { ReportsViewSkeleton } from "@/components/reports-view";

// Skeleton del dashboard: el estado skeleton real de ReportsView, co-locado en
// el componente — misma silueta (header, chips, hero + KPIs, paneles, últimas
// ventas) que el contenido que lo va a reemplazar.
export default function Loading() {
  return <ReportsViewSkeleton />;
}
