import { AppShell, PageHeader } from "@/components/app-shell";
import { RecetasManager } from "@/components/recetas-manager";
import { AppModule, Unit } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { unitLabel } from "@/lib/quantity";
import { getBranchesForManagement } from "@/modules/branches/get-branches-for-management.use-case";
import { desglosarReceta, margenDeProducto } from "@/modules/tables/recipes";
import { estadoDeVencimiento, textoDeVencimiento } from "@/modules/stock/vencimientos";
import { findElaborablesLista, findInsumos, findRecetaDeProducto } from "@/modules/tables/recipes.repository";

/**
 * Insumos y recetas: cuánto cuesta de verdad cada budín.
 *
 * La receta se carga una vez. Cuando sube la harina, el costo de todo lo que
 * la lleva se recalcula solo, porque sale del costo del insumo y no de un
 * número escrito a mano que nadie vuelve a tocar.
 */

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

type RecetasPageProps = {
  searchParams: Promise<{
    branchId?: string | string[];
    producto?: string | string[];
    estado?: string | string[];
    mensaje?: string | string[];
  }>;
};

export default async function RecetasPage({ searchParams }: RecetasPageProps) {
  const { session } = await requireModule(AppModule.RECIPES);
  const params = await searchParams;

  const sucursales = await getBranchesForManagement(session.user.businessId);
  const branchId = uno(params.branchId) || sucursales[0]?.id || "";

  // La lista y la receta se piden por separado: la lista es solo nombres y un
  // conteo, así que con mil productos sigue siendo una consulta liviana. Traer
  // los renglones de todos para pintar el selector era cargar mil recetas con
  // sus insumos para mostrar mil nombres.
  const [insumos, elaborables] = await Promise.all([
    findInsumos(session.user.businessId, branchId),
    findElaborablesLista(session.user.businessId),
  ]);

  const productoPedido = uno(params.producto);
  const elegido = elaborables.find((p) => p.id === productoPedido) ?? elaborables[0];
  const producto = elegido ? await findRecetaDeProducto(session.user.businessId, elegido.id, branchId) : null;

  const desglose = desglosarReceta(
    (producto?.receta ?? []).map((r) => ({
      ingredienteId: r.ingredient.id,
      cantidad: r.quantity,
      costoPorUnidad: r.ingredient.cost,
    })),
  );
  const precio = producto?.branchPrices?.[0]?.price ?? null;

  const mensaje = uno(params.mensaje);
  const estado = uno(params.estado);
  // Una sola referencia para toda la pantalla: si cada fila preguntara la hora
  // por su cuenta, dos filas podrían caer en días distintos.
  const hoy = new Date();

  return (
    <AppShell>
      <PageHeader title="Recetas" description="Qué insumo lleva cada producto, y cuánto cuesta hacerlo." />

      {mensaje ? (
        <p
          className={`rounded-xl px-4 py-3 text-sm font-semibold ${
            estado === "error" ? "bg-destructive/10 text-destructive" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {mensaje}
        </p>
      ) : null}

      <RecetasManager
        branchId={branchId}
        costo={desglose.total}
        elaborables={elaborables.map((p) => ({ id: p.id, name: p.name, renglones: p._count.receta }))}
        insumos={insumos.map((i) => {
          const stock = i.stockLevels[0]?.quantity ?? 0;
          const expiresAt = i.stockLevels[0]?.expiresAt ?? null;
          const vencimiento = estadoDeVencimiento(expiresAt, hoy);

          return {
            id: i.id,
            name: i.name,
            unit: i.unit,
            cost: i.cost,
            stock,
            minStock: i.minStock,
            bajo: i.minStock !== null && stock < i.minStock,
            // ISO corto: es lo que espera un <input type="date">.
            expiresAt: expiresAt ? expiresAt.toISOString().slice(0, 10) : null,
            vencimiento,
            // Solo se avisa lo que hay que resolver; "ok" y "sin-fecha" no son
            // noticias.
            textoVencimiento:
              vencimiento === "ok" || vencimiento === "sin-fecha" ? null : textoDeVencimiento(vencimiento),
          };
        })}
        margen={margenDeProducto(precio, desglose.total)}
        precio={precio}
        producto={producto ? { id: producto.id, name: producto.name, renglones: producto.receta.length } : null}
        renglones={(producto?.receta ?? []).map((r, indice) => ({
          id: r.id,
          ingredienteId: r.ingredient.id,
          nombre: r.ingredient.name,
          unit: r.ingredient.unit,
          cantidad: r.quantity,
          costo: desglose.renglones[indice]?.costo ?? 0,
          porcentaje: desglose.renglones[indice]?.porcentaje ?? 0,
          sinCosto: desglose.renglones[indice]?.sinCosto ?? false,
        }))}
        sinCostear={desglose.sinCostear}
        unidades={Object.values(Unit).map((u) => ({ value: u, label: unitLabel(u) }))}
      />
    </AppShell>
  );
}
