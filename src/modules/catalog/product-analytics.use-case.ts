import { SaleStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

import { analizarProducto, type AnalisisDeProducto } from "./product-analytics.logic";
import { serieDiaria, type DiaDeLaSerie } from "./serie-diaria.logic";
import { calcularRendimiento, type Rendimiento } from "./rendimiento.logic";

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

// Serie de facturación día por día, para el gráfico de la ficha.
//
// Va aparte de `analizarProductoEnPeriodo` y no como un campo más: ese análisis
// lo pide toda la pestaña apenas se abre, y la serie solo la necesita el
// gráfico. Sumarla ahí sería traer siete días de renglones para quien solo mira
// las cuatro tarjetas de arriba.
//
// Las canceladas quedan afuera, igual que en el análisis: sumarlas dibujaría un
// pico de un día que después no entró.
export async function serieDiariaDeProducto(input: {
  businessId: string;
  productId: string;
  hasta: Date;
  dias: number;
}): Promise<DiaDeLaSerie[]> {
  const { businessId, productId, hasta, dias } = input;

  const desde = new Date(hasta);
  desde.setDate(hasta.getDate() - (dias - 1));
  desde.setHours(0, 0, 0, 0);

  const finDelDia = new Date(hasta);
  finDelDia.setHours(23, 59, 59, 999);

  const renglones = await prisma.saleItem.findMany({
    where: {
      productId,
      deleted: false,
      sale: {
        deleted: false,
        status: { not: SaleStatus.CANCELLED },
        soldAt: { gte: desde, lte: finDelDia },
        branch: { businessId, deleted: false },
      },
    },
    select: { total: true, sale: { select: { soldAt: true } } },
  });

  return serieDiaria({
    ventas: renglones.map((r) => ({ at: r.sale.soldAt, facturado: r.total })),
    hasta,
    dias,
  });
}

// Cómo le fue al producto CONTRA el resto y contra su propio pasado.
//
// Tres preguntas que las tarjetas de arriba no contestan: si $200.000 es mucho
// o poco, cuánto del mostrador explica, y si viene subiendo o bajando.
//
// Se agrupa en la base (`groupBy`) y no se traen los renglones a memoria: en un
// catálogo con movimiento serían decenas de miles de filas para calcular una
// suma que Postgres hace sola.
export async function rendimientoDeProducto(input: {
  businessId: string;
  productId: string;
  desde: Date;
  hasta: Date;
}): Promise<Rendimiento & { categoriaNombre: string | null }> {
  const { businessId, productId, desde, hasta } = input;

  const producto = await prisma.product.findFirst({
    where: { id: productId, businessId, deleted: false },
    select: { categoryId: true, category: { select: { name: true } } },
  });

  if (!producto) {
    return { puesto: null, deCuantos: 0, participacion: null, variacion: null, categoriaNombre: null };
  }

  // El período anterior tiene el MISMO largo, corrido hacia atrás: comparar un
  // mes contra una semana daría una caída inventada.
  const largo = hasta.getTime() - desde.getTime();
  const desdeAnterior = new Date(desde.getTime() - largo);

  const ventaValida = {
    deleted: false,
    status: { not: SaleStatus.CANCELLED },
    branch: { businessId, deleted: false },
  };

  const [porProducto, anterior, productos] = await Promise.all([
    prisma.saleItem.groupBy({
      by: ["productId"],
      where: { deleted: false, sale: { ...ventaValida, soldAt: { gte: desde, lt: hasta } } },
      _sum: { total: true },
    }),
    prisma.saleItem.aggregate({
      where: {
        productId,
        deleted: false,
        sale: { ...ventaValida, soldAt: { gte: desdeAnterior, lt: desde } },
      },
      _sum: { total: true },
    }),
    prisma.product.findMany({
      where: { businessId, deleted: false },
      select: { id: true, categoryId: true },
    }),
  ]);

  const categoriaPorProducto = new Map(productos.map((p) => [p.id, p.categoryId]));

  const rendimiento = calcularRendimiento({
    productId,
    categoryId: producto.categoryId,
    // Los renglones sin producto (ítem suelto tipeado en el mostrador) no
    // compiten en el ranking: no son productos del catálogo. Sí siguen contando
    // para el total del negocio... y por eso NO se filtran antes de sumar.
    ventas: porProducto
      .filter((fila): fila is typeof fila & { productId: string } => fila.productId !== null)
      .map((fila) => ({
        productId: fila.productId,
        facturado: fila._sum.total ?? 0,
        categoryId: categoriaPorProducto.get(fila.productId) ?? null,
      })),
    facturadoPeriodoAnterior: anterior._sum.total ?? 0,
  });

  return { ...rendimiento, categoriaNombre: producto.category?.name ?? null };
}
