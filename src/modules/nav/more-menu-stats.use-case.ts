import "server-only";

import { KdsStatus, StockMovementType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

type StatFetcher = (businessId: string, branchId: string) => Promise<number>;

const DIA_MS = 24 * 60 * 60 * 1000;

// Un conteo por atajo del menú "Más". Cada uno refleja lo mismo que el dueño
// vería si entrara a esa pantalla, no un número inventado para que la tarjeta
// no quede vacía.
const FETCHERS: Record<string, StatFetcher> = {
  "/salon": (businessId, branchId) => prisma.table.count({ where: { businessId, branchId, deleted: false } }),
  "/cocina": (businessId, branchId) =>
    prisma.orderItem.count({
      where: {
        order: { businessId, branchId, deleted: false },
        // Mismo filtro que ya usa la pantalla de cocina: lo que todavía no
        // salió de la cocina.
        kdsStatus: { in: [KdsStatus.PENDING, KdsStatus.PREPARING, KdsStatus.READY] },
      },
    }),
};

/**
 * Cuánto hay en cada módulo del menú "Más": lo que convierte la lista de
 * atajos en un tablero chico.
 *
 * Se pide recién al abrir el modal (ver `fetchMoreMenuStatsAction`), no en el
 * layout raíz: ese se renderiza en CADA navegación de la app, y siete
 * conteos de más en cada click —para un modal que la mayoría abre poco— es
 * plata tirada.
 */
export async function getMoreMenuStats(input: {
  businessId: string;
  branchId: string;
  hrefs: string[];
}): Promise<Record<string, number>> {
  const pedidos = input.hrefs.filter((href) => href in FETCHERS);
  const resultados = await Promise.all(
    pedidos.map(async (href) => [href, await FETCHERS[href](input.businessId, input.branchId)] as const),
  );

  return Object.fromEntries(resultados);
}
