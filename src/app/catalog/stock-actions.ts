"use server";

import { AppModule } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getStockErrorMessageFor } from "@/lib/stock-error-messages";
import { StockError } from "@/modules/stock/stock.errors";
import { adjustStock, receiveStock, registerStockLoss } from "@/modules/stock/stock.use-cases";

// Operaciones de stock sobre UN producto, disparadas desde su propia ficha.
//
// Existían solo en la pantalla de Stock, donde había que volver a elegir el
// producto en un `select` de doscientas opciones —justo el que ya estabas
// mirando—. Acá el producto ya está: se toca "Ajustar" y se escribe el número.
//
// Devuelven resultado en vez de redirigir: el redirect a la misma ruta no
// refresca el árbol y la existencia seguiría mostrando el valor viejo.

export type StockOpResult = { ok: true; quantity: number } | { ok: false; error: string };

export type StockOp = "adjust" | "receive" | "loss";

export async function applyProductStockAction(input: {
  op: StockOp;
  productId: string;
  branchId: string;
  // Cantidad en milésimas (ver src/lib/quantity.ts).
  quantity: number;
  reason?: string;
  unitCost?: number | null;
}): Promise<StockOpResult> {
  const { session } = await requireModule(AppModule.STOCK);

  const common = {
    businessId: session.user.businessId,
    branchId: input.branchId,
    productId: input.productId,
    reason: input.reason?.trim() || undefined,
    userId: session.user.id,
  };

  try {
    if (input.op === "adjust") {
      await adjustStock({ ...common, countedQuantity: input.quantity });
    } else if (input.op === "receive") {
      await receiveStock({ ...common, quantity: input.quantity, unitCost: input.unitCost ?? null });
    } else {
      await registerStockLoss({ ...common, quantity: input.quantity });
    }
  } catch (error) {
    if (error instanceof StockError) {
      return { ok: false, error: getStockErrorMessageFor(error) };
    }

    await logError(`stock.${input.op}`, error, {
      businessId: session.user.businessId,
      userId: session.user.id,
      context: { productId: input.productId, branchId: input.branchId },
    });
    return { ok: false, error: "No pudimos completar la operación. Intentá de nuevo." };
  }

  // El panel conserva el valor confirmado localmente y refresca el catálogo
  // al cerrar la ficha. Revalidar dentro de esta Server Action haría que Next
  // entregue un árbol RSC nuevo y reemplazaría el formulario en medio de una
  // segunda operación rápida.

  const level = await prisma.stockLevel.findUnique({
    where: { branchId_productId: { branchId: input.branchId, productId: input.productId } },
    select: { quantity: true },
  });
  return { ok: true, quantity: level?.quantity ?? 0 };
}
