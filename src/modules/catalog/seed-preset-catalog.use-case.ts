import { ProductKind, StockMovementType, Unit } from "@/generated/prisma/client";
import { logEvent } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { ONE } from "@/lib/quantity";
import { verticalPreset } from "@/lib/vertical";

import { ProductError, ProductErrorCode } from "./product.errors";

// Carga el catálogo típico del rubro de una.
//
// Antes esto pasaba solo, en el alta del negocio: el dueño terminaba el
// registro y se encontraba con seis productos que nunca pidió. Ahora es una
// decisión suya, desde adentro de la app y con el catálogo vacío a la vista,
// que es el momento en que la pregunta tiene sentido.
//
// Es idempotente por nombre: si ya existe un producto que se llama igual, se
// saltea. Así tocar el botón dos veces no duplica nada.

export async function seedPresetCatalog(input: { businessId: string; branchId: string; userId?: string | null }) {
  const business = await prisma.business.findFirst({
    where: { id: input.businessId, deleted: false },
    select: { vertical: true },
  });

  if (!business) {
    throw new ProductError(ProductErrorCode.PRODUCT_NOT_FOUND);
  }

  const branch = await prisma.branch.findFirst({
    where: { id: input.branchId, businessId: input.businessId, deleted: false, active: true },
    select: { id: true },
  });

  if (!branch) {
    throw new ProductError(ProductErrorCode.BRANCH_NOT_FOUND);
  }

  const preset = verticalPreset(business.vertical);

  if (preset.catalog.length === 0) {
    return { created: 0 };
  }

  const existing = await prisma.product.findMany({
    where: { businessId: input.businessId, deleted: false },
    select: { name: true },
  });
  const taken = new Set(existing.map((product) => product.name.toLowerCase()));

  const pending = preset.catalog.filter((seed) => !taken.has(seed.name.toLowerCase()));

  if (pending.length === 0) {
    return { created: 0 };
  }

  await prisma.$transaction(async (tx) => {
    const categories = await tx.productCategory.findMany({
      where: { businessId: input.businessId, deleted: false },
      select: { id: true, name: true },
    });
    const categoryIdByName = new Map(categories.map((category) => [category.name, category.id]));

    for (const name of preset.categories) {
      if (categoryIdByName.has(name)) continue;
      const category = await tx.productCategory.create({ data: { businessId: input.businessId, name } });
      categoryIdByName.set(name, category.id);
    }

    for (const seed of pending) {
      const kind = seed.kind ?? ProductKind.SERVICE;
      const tracksStock = kind === ProductKind.GOOD;

      const product = await tx.product.create({
        data: {
          businessId: input.businessId,
          categoryId: categoryIdByName.get(seed.category) ?? null,
          name: seed.name,
          kind,
          unit: seed.unit ?? Unit.UNIT,
          cost: seed.cost ?? null,
          trackStock: tracksStock,
          active: true,
          createdById: input.userId,
          updatedById: input.userId,
        },
      });

      await tx.branchProductPrice.create({
        data: { branchId: branch.id, productId: product.id, price: seed.price, active: true },
      });

      // La existencia inicial va con su movimiento: el stock siempre se explica
      // por el libro, nunca aparece de la nada.
      if (tracksStock && seed.stock) {
        const quantity = seed.stock * ONE;

        await tx.stockMovement.create({
          data: {
            branchId: branch.id,
            productId: product.id,
            type: StockMovementType.INITIAL,
            quantity,
            unitCost: seed.cost ?? null,
            reason: "Carga inicial del rubro",
            createdById: input.userId,
          },
        });

        await tx.stockLevel.create({ data: { branchId: branch.id, productId: product.id, quantity } });
      }
    }
  });

  await logEvent("catalog.seed-preset", `${pending.length} ítems del rubro cargados`, {
    businessId: input.businessId,
    userId: input.userId ?? undefined,
    context: { branchId: branch.id, created: pending.length, vertical: business.vertical },
  });

  return { created: pending.length };
}
