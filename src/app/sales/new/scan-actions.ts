"use server";

import { requireAdminSession } from "@/lib/auth";
import { logError } from "@/lib/logger";
import { findProductByCode } from "@/modules/catalog/scan-product.use-case";
import { prisma } from "@/lib/prisma";

// Búsqueda de un código durante la venta.
//
// El mostrador tiene el catálogo de la sucursal en memoria desde que se abrió la
// pantalla, y ahí buscaba primero. El problema: si el producto se cargó recién
// —en otra pestaña, desde el catálogo, o por otra persona— no está en esa lista
// y el lector decía "no está en el catálogo" sobre algo que SÍ estaba cargado.
//
// Por eso, cuando la lista local no lo tiene, se le pregunta a la base. Y se
// distinguen los tres casos, que para el que atiende son problemas distintos:
//   - se puede vender  → entra al pedido
//   - existe pero sin precio en ESTA sucursal → hay que ponerle precio
//   - no existe        → hay que darlo de alta

export type ScanLookup =
  | {
      status: "sellable";
      product: {
        productId: string;
        name: string;
        price: number;
        unit: string;
        stock: number | null;
        imageVersion: number | null;
        catalogSlug: string | null;
        packSize: number | null;
        packLabel: string | null;
      };
    }
  // Existe, pero en esta sucursal nunca se le puso precio.
  | { status: "no-price"; name: string }
  // Tiene precio en esta sucursal, pero está apagado ("Disponible para vender").
  | { status: "unavailable"; name: string }
  // El producto entero está dado de baja.
  | { status: "inactive"; name: string }
  | { status: "unknown" };

export async function findProductToSell(input: { code: string; branchId: string }): Promise<ScanLookup> {
  const session = await requireAdminSession();

  try {
    const found = await findProductByCode({
      businessId: session.user.businessId,
      branchId: input.branchId,
      code: input.code,
    });

    if (!found) {
      return { status: "unknown" };
    }

    if (!found.active) {
      return { status: "inactive", name: found.name };
    }

    if (found.price === null) {
      // Distinguimos "nunca le puse precio acá" de "lo apagué": para quien
      // atiende son dos problemas distintos y se arreglan en lugares distintos.
      const precio = await prisma.branchProductPrice.findFirst({
        where: { productId: found.id, branchId: input.branchId, deleted: false },
        select: { active: true },
      });

      return precio ? { status: "unavailable", name: found.name } : { status: "no-price", name: found.name };
    }

    // El bulto no viene en la búsqueda del escáner (que es común con el
    // catálogo), así que se completa acá.
    const extra = await prisma.product.findFirst({
      where: { id: found.id },
      select: { packSize: true, packLabel: true },
    });

    return {
      status: "sellable",
      product: {
        productId: found.id,
        name: found.name,
        price: found.price,
        unit: found.unit,
        stock: found.stock,
        imageVersion: found.imageVersion,
        catalogSlug: found.catalogSlug,
        packSize: extra?.packSize ?? null,
        packLabel: extra?.packLabel ?? null,
      },
    };
  } catch (error) {
    await logError("sale.scan.lookup", error, {
      businessId: session.user.businessId,
      userId: session.user.id,
      context: { branchId: input.branchId },
    });
    return { status: "unknown" };
  }
}
