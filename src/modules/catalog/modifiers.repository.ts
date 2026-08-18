import { prisma } from "@/lib/prisma";

/**
 * Grupos de opciones y a qué productos se les ofrecen.
 */

export function findGruposConModificadores(businessId: string) {
  return prisma.modifierGroup.findMany({
    where: { businessId, deleted: false },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      required: true,
      minSelect: true,
      maxSelect: true,
      modifiers: {
        where: { deleted: false },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, priceDelta: true },
      },
      products: {
        where: { deleted: false },
        select: { id: true, name: true },
      },
    },
  });
}

export function findProductosParaAsignar(businessId: string) {
  return prisma.product.findMany({
    where: { businessId, deleted: false },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export function crearGrupo(input: {
  businessId: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  userId: string;
}) {
  return prisma.modifierGroup.create({
    data: {
      businessId: input.businessId,
      name: input.name,
      required: input.required,
      minSelect: input.minSelect,
      maxSelect: input.maxSelect,
      createdById: input.userId,
    },
    select: { id: true },
  });
}

export function crearModificador(input: {
  businessId: string;
  groupId: string;
  name: string;
  priceDelta: number;
  userId: string;
}) {
  return prisma.modifier.create({
    data: {
      businessId: input.businessId,
      groupId: input.groupId,
      name: input.name,
      priceDelta: input.priceDelta,
      createdById: input.userId,
    },
    select: { id: true },
  });
}

/** Reemplaza a qué productos se les ofrece el grupo. */
export function asignarProductos(groupId: string, businessId: string, productIds: string[]) {
  return prisma.modifierGroup.update({
    where: { id: groupId, businessId },
    data: { products: { set: productIds.map((id) => ({ id })) } },
    select: { id: true },
  });
}

export function borrarGrupo(groupId: string, businessId: string, userId: string) {
  // Borrado lógico como todo en Bills: una comanda vieja puede seguir
  // apuntando a este grupo.
  return prisma.modifierGroup.update({
    where: { id: groupId, businessId },
    data: { deleted: true, deletedAt: new Date(), deletedById: userId },
    select: { id: true },
  });
}

export function borrarModificador(modifierId: string, businessId: string, userId: string) {
  return prisma.modifier.update({
    // El modificador cuelga del grupo, que sí tiene negocio.
    where: { id: modifierId, group: { businessId } },
    data: { deleted: true, deletedAt: new Date(), deletedById: userId },
    select: { id: true },
  });
}

/** Los grupos que se le ofrecen a un producto, con sus opciones. */
export function findGruposDeProducto(businessId: string, productId: string) {
  return prisma.modifierGroup.findMany({
    where: { businessId, deleted: false, products: { some: { id: productId } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      required: true,
      minSelect: true,
      maxSelect: true,
      modifiers: {
        where: { deleted: false },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, priceDelta: true },
      },
    },
  });
}

/**
 * Prende o apaga UN grupo para UN producto.
 *
 * Distinta de `asignarProductos`, que hace `set` con la lista completa: desde la
 * ficha de un producto no se conoce a los otros, así que un `set` con un solo id
 * le sacaría el grupo a los demás productos que lo tenían.
 *
 * El `businessId` va en el where del grupo: sin eso alcanzaría con mandar el id
 * de un grupo ajeno para engancharlo a un producto propio.
 */
export function togglearGrupoDeProducto(input: {
  businessId: string;
  groupId: string;
  productId: string;
  incluir: boolean;
}) {
  return prisma.modifierGroup.update({
    where: { id: input.groupId, businessId: input.businessId },
    data: {
      products: input.incluir
        ? { connect: { id: input.productId } }
        : { disconnect: { id: input.productId } },
    },
    select: { id: true },
  });
}

/** Todos los grupos del negocio, para elegir cuáles lleva un producto. */
export function findGruposDelNegocio(businessId: string) {
  return prisma.modifierGroup.findMany({
    where: { businessId, deleted: false },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      required: true,
      _count: { select: { modifiers: { where: { deleted: false } } } },
    },
  });
}
