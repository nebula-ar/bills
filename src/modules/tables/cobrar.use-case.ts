import { OrderStatus, SaleChannel, SaleStatus, TableStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

import { totalesDeComanda } from "./order-lifecycle";

/**
 * Cobrar una comanda: se convierte en venta y la mesa queda libre.
 *
 * La venta guarda de dónde salió —canal TABLE, nombre de la mesa y del mozo—
 * como COPIA y no como relación: el comprobante de hace seis meses tiene que
 * seguir diciendo "Vereda 1, atendió Vero" aunque la mesa ya no exista.
 *
 * La propina va en su campo, aparte del subtotal. Es plata del mozo: sumarla a
 * lo facturado infla la contabilidad del negocio con algo ajeno, pero tiene que
 * estar en la venta igual porque el arqueo cuenta lo que entró al cajón.
 */

export type Resultado = { ok: true; saleId: string } | { ok: false; error: string };

export async function cobrarComanda(input: {
  businessId: string;
  tableId: string;
  propina: number;
  staffId: string;
}): Promise<Resultado> {
  const comanda = await prisma.order.findFirst({
    where: { tableId: input.tableId, status: OrderStatus.OPEN, deleted: false },
    select: {
      id: true,
      branchId: true,
      discount: true,
      version: true,
      table: { select: { name: true } },
      staff: { select: { name: true } },
      items: {
        select: {
          productId: true,
          description: true,
          unitPrice: true,
          quantity: true,
          total: true,
        },
      },
    },
  });

  if (!comanda) return { ok: false, error: "Esta mesa no tiene una comanda abierta" };
  if (comanda.items.length === 0) return { ok: false, error: "La comanda está vacía" };

  const propina = Number.isInteger(input.propina) && input.propina >= 0 ? input.propina : 0;
  const totales = totalesDeComanda(comanda.items, comanda.discount, propina);

  try {
    const venta = await prisma.$transaction(async (tx) => {
      // Candado optimista: si otro dispositivo tocó la comanda desde que esta
      // pantalla la leyó, no se cobra un total viejo.
      const tomada = await tx.order.updateMany({
        where: { id: comanda.id, version: comanda.version, status: OrderStatus.OPEN },
        data: { version: { increment: 1 } },
      });
      if (tomada.count === 0) {
        throw new Error("La comanda cambió mientras la cobrabas. Miralaa de nuevo.");
      }

      const sale = await tx.sale.create({
        data: {
          branchId: comanda.branchId,
          staffId: input.staffId,
          subtotal: totales.subtotal,
          discountTotal: comanda.discount,
          tip: propina,
          total: totales.total,
          status: SaleStatus.COMPLETED,
          channel: SaleChannel.TABLE,
          tableName: comanda.table?.name ?? null,
          waiterName: comanda.staff?.name ?? null,
          createdById: input.staffId,
          items: {
            create: comanda.items.map((i) => ({
              productId: i.productId,
              description: i.description,
              unitPrice: i.unitPrice,
              quantity: i.quantity,
              total: i.total,
            })),
          },
        },
        select: { id: true },
      });

      await tx.order.update({
        where: { id: comanda.id },
        data: {
          status: OrderStatus.PAID,
          saleId: sale.id,
          tip: propina,
          total: totales.total,
          closedAt: new Date(),
          updatedById: input.staffId,
        },
      });

      await tx.table.update({
        where: { id: input.tableId },
        data: { status: TableStatus.FREE, updatedById: input.staffId },
      });

      return sale;
    });

    return { ok: true, saleId: venta.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo cobrar la comanda" };
  }
}
