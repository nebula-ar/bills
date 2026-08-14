import { TerminalsManagerSkeleton } from "@/components/terminals-manager";

// Skeleton de terminales: el estado skeleton real de TerminalsManager,
// co-locado en el componente — misma silueta (header, chips, secciones) que el
// contenido que lo va a reemplazar.
export default function Loading() {
  return <TerminalsManagerSkeleton />;
}
