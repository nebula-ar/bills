import { StaffManagerSkeleton } from "@/components/staff-manager";

// Skeleton del personal: el estado skeleton real de StaffManager, co-locado en
// el componente — misma silueta (header, filas de empleado) que el contenido
// que lo va a reemplazar.
export default function Loading() {
  return <StaffManagerSkeleton />;
}
