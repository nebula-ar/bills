import { CashManagerSkeleton } from "@/components/cash-manager";

// Skeleton de caja: el estado skeleton real de CashManager, co-locado en el
// componente — misma silueta (header, chips, hero, acciones, paneles) que el
// contenido que lo va a reemplazar.
export default function Loading() {
  return <CashManagerSkeleton />;
}
