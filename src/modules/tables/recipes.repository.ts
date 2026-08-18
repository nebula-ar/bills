import { ProductKind } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

/**
 * Insumos, recetas y producción.
 *
 * Un insumo es un Product con `kind: INGREDIENT`: se le compra a un proveedor,
 * tiene stock y costo, pero nunca se vende. Reusar Product hace que el stock,
 * las compras y los proveedores ya funcionen para él sin escribir nada.
 *
 * El ALTA de un insumo, su vencimiento y el listado ya no viven acá: un insumo
 * es un producto, así que se crea y se edita desde el catálogo como cualquier
 * otro (ver src/app/catalog). Lo que queda es lo propio de las recetas y de la
 * producción.
 */

/** La receta de UN producto, con su precio en la sucursal para el margen. */
export function findRecetaDeProducto(businessId: string, productId: string, branchId?: string) {
  return prisma.product.findFirst({
    where: { id: productId, businessId, kind: { not: ProductKind.INGREDIENT }, deleted: false },
    select: {
      id: true,
      name: true,
      // El precio de venta en la sucursal, para poder decir qué queda de hacer
      // uno. Sin él la pantalla dice cuánto cuesta y calla lo único que se
      // quiere saber: si conviene.
      branchPrices: branchId
        ? { where: { branchId, deleted: false, active: true }, select: { price: true }, take: 1 }
        : false,
      receta: {
        select: {
          id: true,
          quantity: true,
          ingredient: {
            select: {
              id: true,
              name: true,
              unit: true,
              cost: true,
              // Cuánto hay del insumo en la sucursal: con eso la receta puede
              // decir para cuántas unidades alcanza, que es lo que frena la
              // producción y no se ve en ningún otro lado.
              stockLevels: branchId
                ? { where: { branchId }, select: { quantity: true }, take: 1 }
                : false,
            },
          },
        },
      },
    },
  });
}

/**
 * Un insumo del negocio, con su unidad.
 *
 * La unidad es el dato que hace falta ANTES de interpretar la cantidad de un
 * renglón: `RecipeItem.quantity` son milésimas de la unidad del insumo, y si se
 * parsea con la unidad equivocada la receta guarda otra cosa. El filtro por
 * `businessId` va en la firma, no en el llamador: es lo que evita meter el
 * insumo de otro negocio en la receta propia.
 */
export function findInsumoDelNegocio(businessId: string, ingredientId: string) {
  return prisma.product.findFirst({
    where: { id: ingredientId, businessId, kind: ProductKind.INGREDIENT, deleted: false },
    select: { id: true, name: true, unit: true },
  });
}

export function ponerEnReceta(input: {
  productId: string;
  businessId: string;
  ingredientId: string;
  quantity: number;
}) {
  return prisma.recipeItem.upsert({
    where: {
      productId_ingredientId: { productId: input.productId, ingredientId: input.ingredientId },
      // El plato y el insumo tienen que ser los dos de este negocio: sin
      // esto se podía meter el insumo de otro en la receta propia.
      product: { businessId: input.businessId },
      ingredient: { businessId: input.businessId },
    },
    create: {
      productId: input.productId,
      ingredientId: input.ingredientId,
      quantity: input.quantity,
    },
    update: { quantity: input.quantity },
    select: { id: true },
  });
}

export function sacarDeReceta(recipeItemId: string, businessId: string) {
  return prisma.recipeItem.deleteMany({
    where: { id: recipeItemId, product: { businessId } },
  });
}

export function findReceta(businessId: string, productId: string) {
  return prisma.recipeItem.findMany({
    where: { productId, product: { businessId } },
    select: {
      id: true,
      quantity: true,
      ingredientId: true,
      ingredient: { select: { name: true, unit: true, cost: true } },
    },
  });
}

export function findStockDeInsumos(branchId: string, ingredientIds: string[]) {
  return prisma.stockLevel.findMany({
    where: { branchId, productId: { in: ingredientIds } },
    select: { productId: true, quantity: true },
  });
}

/**
 * Registra una tanda: suma el producto terminado y descuenta los insumos.
 *
 * Todo en una transacción: una producción a medias deja el stock mintiendo,
 * y el stock que miente es peor que no tener stock.
 */
export function registrarProduccion(input: {
  businessId: string;
  branchId: string;
  productId: string;
  unidades: number;
  consumo: { ingredienteId: string; cantidad: number }[];
  staffId: string;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.production.create({
      data: {
        businessId: input.businessId,
        branchId: input.branchId,
        productId: input.productId,
        quantity: input.unidades,
        staffId: input.staffId,
        createdById: input.staffId,
      },
    });

    // Lo producido entra al stock.
    await tx.stockLevel.upsert({
      where: { branchId_productId: { branchId: input.branchId, productId: input.productId } },
      create: { branchId: input.branchId, productId: input.productId, quantity: input.unidades },
      update: { quantity: { increment: input.unidades } },
    });

    // Y los insumos salen.
    for (const c of input.consumo) {
      await tx.stockLevel.upsert({
        where: { branchId_productId: { branchId: input.branchId, productId: c.ingredienteId } },
        create: { branchId: input.branchId, productId: c.ingredienteId, quantity: -c.cantidad },
        update: { quantity: { decrement: c.cantidad } },
      });
    }
  });
}

