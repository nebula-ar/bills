"use server";

import { requireBusinessContext } from "@/lib/business-context";
import { logError } from "@/lib/logger";
import { getProductErrorMessage } from "@/lib/catalog-error-messages";
import { ProductError } from "@/modules/catalog/product.errors";
import { seedPresetCatalog } from "@/modules/catalog/seed-preset-catalog.use-case";
import { revalidatePath } from "next/cache";

export type SeedCatalogResult = { ok: true; created: number } | { ok: false; error: string };

// Carga el catálogo típico del rubro desde el estado vacío del catálogo.
export async function seedPresetCatalogAction(branchId: string): Promise<SeedCatalogResult> {
  const { session } = await requireBusinessContext();

  try {
    const { created } = await seedPresetCatalog({
      businessId: session.user.businessId,
      branchId,
      userId: session.user.id,
    });

    // Los productos aparecen en el catálogo, en el mostrador y en stock.
    revalidatePath("/catalog");
    revalidatePath("/sales/new");
    revalidatePath("/stock");
    revalidatePath("/");

    return { ok: true, created };
  } catch (error) {
    if (error instanceof ProductError) {
      return { ok: false, error: getProductErrorMessage(error.code) };
    }

    await logError("catalog.seed-preset", error, {
      businessId: session.user.businessId,
      userId: session.user.id,
      context: { branchId },
    });
    return { ok: false, error: "No pudimos cargar el catálogo. Intentá de nuevo." };
  }
}
