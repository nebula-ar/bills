import { ProductsManagerSkeleton } from "@/components/catalog-manager";
import { SyncfusionCatalogProvider } from "@/components/syncfusion-catalog-provider";

// Skeleton del catálogo: el estado skeleton real de ProductsManager, co-locado
// en el componente — misma silueta (header, chips, buscador, filas) que el
// contenido que lo va a reemplazar. Con el provider Syncfusion de encima para
// que el cambio de skeleton → contenido no parpadee los estilos de EJ2.
export default function Loading() {
  return (
    <SyncfusionCatalogProvider>
      <ProductsManagerSkeleton />
    </SyncfusionCatalogProvider>
  );
}
