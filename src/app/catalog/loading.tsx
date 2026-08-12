import { ProductsManagerSkeleton } from "@/components/catalog-manager";

// Skeleton del catálogo: el estado skeleton real de ProductsManager, co-locado
// en el componente — misma silueta (header, chips, buscador, filas) que el
// contenido que lo va a reemplazar.
export default function Loading() {
  return <ProductsManagerSkeleton />;
}
