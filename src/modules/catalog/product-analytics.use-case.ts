import { SaleStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

import { analizarProducto, type AnalisisDeProducto } from "./product-analytics.logic";

/**
 * Junta los movimientos de un producto en un período y los pasa por la lógica.
 *
 * Se consulta bajo demanda, cuando se abre la pestaña de análisis: son cuatro
 * consultas por producto, y hacerlas para todo el catálogo al pintar la lista
 * sería pagar por lo que casi nadie mira.
 */
export async function analizarProductoEnPeriodo(input: {
  businessId: string;
  productId: string;
  desde: Date;
  hasta: Date;
}): Promise<AnalisisDeProducto> {
  const { businessId, productId, desde, hasta } = input;

  // Que el producto sea del negocio se valida acá y no se asume del id: el id
  // viaja desde el cliente.
  const producto = await prisma.product.findFirst({
    where: { id: productId, businessId, deleted: false },
    select: { id: true, cost: true },
  });

  if (!producto) {
    return analizarProducto({ vendidos: [], comprados: [], tirados: [], costoActual: null });
  }

  const [vendidos, comprados, tirados] = await Promise.all([
    prisma.saleItem.findMany({
      where: {
        productId,
        deleted: false,
        // Las canceladas no son ventas: sumarlas mostraría un margen que nunca
        // entró, igual que en el historial.
        sale: {
          deleted: false,
          status: { not: SaleStatus.CANCELLED },
          soldAt: { gte: desde, lt: hasta },
          branch: { businessId, deleted: false },
        },
      },
      select: {
        saleId: true,
        quantity: true,
        total: true,
        discount: true,
        unitCost: true,
        sale: { select: { soldAt: true } },
        returns: { select: { quantity: true, amount: true } },
      },
    }),
    prisma.purchaseItem.findMany({
      where: {
        productId,
        purchase: { businessId, deleted: false, createdAt: { gte: desde, lt: hasta } },
      },
      select: { quantity: true, unitCost: true, createdAt: true },
    }),
    prisma.waste.findMany({
      where: { productId, businessId, createdAt: { gte: desde, lt: hasta } },
      select: { quantity: true },
    }),
  ]);

  return analizarProducto({
    vendidos: vendidos.map((renglon) => ({
      saleId: renglon.saleId,
      quantity: renglon.quantity,
      total: renglon.total,
      discount: renglon.discount,
      unitCost: renglon.unitCost,
      soldAt: renglon.sale.soldAt,
      // Un renglón puede tener varias devoluciones parciales.
      devuelto: renglon.returns.reduce(
        (suma, devolucion) => ({
          quantity: suma.quantity + devolucion.quantity,
          amount: suma.amount + devolucion.amount,
        }),
        { quantity: 0, amount: 0 },
      ),
    })),
    comprados: comprados.map((renglon) => ({
      quantity: renglon.quantity,
      unitCost: renglon.unitCost,
      at: renglon.createdAt,
    })),
    tirados: tirados,
    costoActual: producto.cost,
  });
}
