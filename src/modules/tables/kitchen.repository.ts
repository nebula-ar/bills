import { KdsStatus, OrderStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

/**
 * Lo que la cocina tiene que preparar.
 *
 * Se traen los renglones de comandas ABIERTAS, con el nombre de la mesa: el
 * cocinero no sabe qué es la comanda #47, sabe qué es "Vereda 1".
 */
export function findRenglonesDeCocina(businessId: string, branchId: string) {
  return prisma.orderItem.findMany({
    where: {
      order: { businessId, branchId, status: OrderStatus.OPEN, deleted: false },
      // El carrito del QR no llega acá: lo cargó el cliente y el mozo todavía
      // no lo confirmó. Ver `enTablero` en kitchen.ts.
      kdsStatus: { in: [KdsStatus.PENDING, KdsStatus.PREPARING, KdsStatus.READY] },
    },
    orderBy: { sentToKitchenAt: "asc" },
    select: {
      id: true,
      description: true,
      quantity: true,
      note: true,
      kdsStatus: true,
      sentToKitchenAt: true,
      order: {
        select: {
          number: true,
          table: { select: { name: true } },
        },
      },
      product: { select: { prepMinutes: true } },
      // La cocina TIENE que ver con qué prepararlo: "Capuccino" a secas y
      // "Capuccino con leche de almendras" son dos tazas distintas.
      modifiers: { select: { id: true, name: true } },
    },
  });
}

export function findRenglon(businessId: string, itemId: string) {
  return prisma.orderItem.findFirst({
    where: { id: itemId, order: { businessId, deleted: false } },
    select: { id: true, kdsStatus: true },
  });
}

export function avanzarRenglon(itemId: string, businessId: string, siguiente: KdsStatus) {
  return prisma.orderItem.update({
    // El renglón se ata por la comanda: OrderItem no tiene businessId propio.
    where: { id: itemId, order: { businessId } },
    data: {
      kdsStatus: siguiente,
      // Se marca cuándo estuvo listo: es el dato con el que después se mide
      // cuánto tarda la cocina de verdad.
      ...(siguiente === KdsStatus.READY ? { readyAt: new Date() } : {}),
    },
    select: { id: true },
  });
}
