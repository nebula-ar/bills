import { ExpensesManagerSkeleton } from "@/components/expenses-manager";

// Skeleton de gastos: el estado skeleton real de ExpensesManager, co-locado en
// el componente — misma silueta (header, navegador de mes, hero, lista) que el
// contenido que lo va a reemplazar.
export default function Loading() {
  return <ExpensesManagerSkeleton />;
}
