import { BranchesManagerSkeleton } from "@/components/branches-manager";

// Skeleton de sucursales: el estado skeleton real de BranchesManager, co-locado
// en el componente — misma silueta (header, filas de sucursal) que el
// contenido que lo va a reemplazar.
export default function Loading() {
  return <BranchesManagerSkeleton />;
}
