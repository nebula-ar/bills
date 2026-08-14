import { redirect } from "next/navigation";

// Retirada: el stock de cada producto —existencia, mínimo, movimientos— ya
// se ve y se toca desde su propia ficha en /catalog, y lo de conjunto
// (faltantes, valorizado, traspasos) vive ahí también. Se deja el redirect y
// no se borra la ruta para no romper accesos guardados (favoritos, atajos).
export default function StockPage() {
  redirect("/catalog");
}
