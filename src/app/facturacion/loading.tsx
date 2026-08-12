import { FiscalProfileManagerSkeleton } from "@/components/fiscal-profile-manager";

// Skeleton de facturación: el estado skeleton real de FiscalProfileManager,
// co-locado en el componente — misma silueta (header, tarjeta fiscal) que el
// contenido que lo va a reemplazar.
export default function Loading() {
  return <FiscalProfileManagerSkeleton />;
}
