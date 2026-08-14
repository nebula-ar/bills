import { FiscalProfileManagerSkeleton } from "@/components/fiscal-profile-manager";
import { SyncfusionFacturacionProvider } from "@/components/syncfusion-facturacion-provider";

// Skeleton de facturación: el estado skeleton real de FiscalProfileManager,
// co-locado en el componente — misma silueta (header, tarjeta fiscal) que el
// contenido que lo va a reemplazar. Con el provider Syncfusion de encima para
// que el cambio de skeleton → contenido no parpadee los estilos de EJ2.
export default function Loading() {
  return (
    <SyncfusionFacturacionProvider>
      <FiscalProfileManagerSkeleton />
    </SyncfusionFacturacionProvider>
  );
}
