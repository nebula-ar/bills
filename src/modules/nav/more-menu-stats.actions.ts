"use server";

import { getCurrentSession } from "@/lib/auth";
import { getBranchesForManagement } from "@/modules/branches/get-branches-for-management.use-case";

import { getMoreMenuStats } from "./more-menu-stats.use-case";

/**
 * Los conteos de las tarjetas del menú "Más". Sin sesión, sin sucursal, no
 * hay nada que contar: se devuelve vacío en vez de tirar error, porque esto
 * es un detalle del menú, no algo que deba romper la navegación.
 */
export async function fetchMoreMenuStatsAction(hrefs: string[]): Promise<Record<string, number>> {
  const session = await getCurrentSession();
  if (!session) return {};

  const sucursales = await getBranchesForManagement(session.user.businessId);
  const branchId = sucursales[0]?.id;
  if (!branchId) return {};

  return getMoreMenuStats({ businessId: session.user.businessId, branchId, hrefs });
}
