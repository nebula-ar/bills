import { KdsStatus, OrderStatus, ProductKind, TableStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { lineTotal, QUANTITY_SCALE } from "@/lib/quantity";
import { LIMITE_CARTA_PUBLICA, checkRateLimit } from "@/lib/rate-limit";
import { effectiveUnitPrice, validarSeleccion } from "@/modules/catalog/modifiers";
import { findGruposDeProducto } from "@/modules/catalog/modifiers.repository";

/**
 * La carta que el cliente abre escaneando el QR de su mesa.
 *
 * No hay sesión: el token de la mesa ES la credencial. Eso obliga a dos cosas
 * que no aplican en las pantallas de adentro.
 *
 * La primera es el freno de frecuencia. Una server action es un POST, así que
 * cualquiera que fotografió el código puede llamarla en bucle desde su casa:
 * sin límite se pueden crear comandas de madrugada, quemar el correlativo del
 * negocio y llenar la base.
 *
 * La segunda es que lo que carga el cliente entra como CART y NO viaja a
 * cocina. Lo confirma el mozo, que es quien ve la mesa. Si no, alcanza con que
 * alguien juegue con el menú mientras espera para que se prepare comida que
 * nadie pidió en firme.
 */

export type Resultado = { ok: true } | { ok: false; error: string };

export async function getCartaPorToken(token: string) {
  const mesa = await prisma.table.findFirst({
    where: { publicToken: token, deleted: false },
    select: {
      id: true,
      name: true,
      branchId: true,
      businessId: true,
      business: { select: { name: true, vertical: true } },
      sector: { select: { name: true } },
    },
  });

  if (!mesa) return null;

  const productos = await prisma.product.findMany({
    where: {
      businessId: mesa.businessId,
      deleted: false,
      kind: { not: ProductKind.INGREDIENT },
      branchPrices: { some: { branchId: mesa.branchId, active: true, deleted: false } },
    },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      imageUpdatedAt: true,
      catalogSlug: true,
      category: { select: { name: true } },
      branchPrices: {
        where: { branchId: mesa.branchId, active: true, deleted: false },
        select: { price: true },
        take: 1,
      },
      modifierGroups: { where: { deleted: false }, select: { id: true }, take: 1 },
    },
  });

  const comanda = await prisma.order.findFirst({
    where: { tableId: mesa.id, status: OrderStatus.OPEN, deleted: false },
    select: {
      id: true,
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          description: true,
          quantity: true,
          total: true,
          kdsStatus: true,
          modifiers: { select: { id: true, name: true } },
        },
      },
    },
  });

  return {
    mesa: { id: mesa.id, name: mesa.name, sector: mesa.sector?.name ?? null },
    negocio: mesa.business.name,
    // El rubro viaja para que la carta se pinte con SU tema. Acá no hay
    // sesión, así que el layout no puede ponerlo: el cliente de una panadería
    // estaba viendo los colores de Bills.
    vertical: mesa.business.vertical,
    productos: productos
      .filter((p) => p.branchPrices.length > 0)
      .map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.branchPrices[0].price,
        categoria: p.category?.name ?? "Sin categoría",
        imageVersion: p.imageUpdatedAt?.getTime() ?? null,
        catalogSlug: p.catalogSlug,
        tieneOpciones: p.modifierGroups.length > 0,
      })),
    // Lo que el cliente ya pidió: sin confirmar (su carrito) y confirmado.
    carrito: (comanda?.items ?? []).filter((i) => i.kdsStatus === KdsStatus.CART),
    confirmados: (comanda?.items ?? []).filter((i) => i.kdsStatus !== KdsStatus.CART),
  };
}

export async function agregarDesdeCarta(input: {
  token: string;
  productId: string;
  modifierIds: string[];
  note: string | null;
}): Promise<Resultado> {
  const limite = checkRateLimit(
    `carta:${input.token}`,
    LIMITE_CARTA_PUBLICA.maximo,
    LIMITE_CARTA_PUBLICA.ventanaMs,
  );
  if (!limite.permitido) {
    return { ok: false, error: "Esperá unos segundos antes de seguir pidiendo" };
  }

  const mesa = await prisma.table.findFirst({
    where: { publicToken: input.token, deleted: false },
    select: { id: true, businessId: true, branchId: true },
  });
  if (!mesa) return { ok: false, error: "Este código de mesa ya no sirve" };

  const grupos = await findGruposDeProducto(mesa.businessId, input.productId);

  // La misma validación que adentro: un modificador de otro producto se
  // rechaza acá. Es justamente desde el QR desde donde se intentaría.
  const problema = validarSeleccion(grupos, input.modifierIds);
  if (problema) return { ok: false, error: problema };

  const precio = await prisma.branchProductPrice.findFirst({
    where: { productId: input.productId, branchId: mesa.branchId, active: true, deleted: false },
    select: { price: true, product: { select: { name: true } } },
  });
  if (!precio) return { ok: false, error: "Ese producto no está disponible" };

  const elegidos = grupos.flatMap((g) => g.modifiers).filter((m) => input.modifierIds.includes(m.id));
  const unitPrice = effectiveUnitPrice(precio.price, elegidos);

  await prisma.$transaction(async (tx) => {
    let comanda = await tx.order.findFirst({
      where: { tableId: mesa.id, status: OrderStatus.OPEN, deleted: false },
      select: { id: true },
    });

    if (!comanda) {
      const ultima = await tx.order.findFirst({
        where: { businessId: mesa.businessId },
        orderBy: { number: "desc" },
        select: { number: true },
      });
      comanda = await tx.order.create({
        data: {
          businessId: mesa.businessId,
          branchId: mesa.branchId,
          tableId: mesa.id,
          // Sin `staffId`: la abrió el cliente, no un empleado.
          staffId: null,
          number: (ultima?.number ?? 0) + 1,
        },
        select: { id: true },
      });
      await tx.table.update({ where: { id: mesa.id }, data: { status: TableStatus.OCCUPIED } });
    }

    await tx.orderItem.create({
      data: {
        orderId: comanda.id,
        productId: input.productId,
        description: precio.product.name,
        unitPrice,
        quantity: QUANTITY_SCALE,
        total: lineTotal(unitPrice, QUANTITY_SCALE),
        note: input.note?.trim().slice(0, 140) || null,
        // CART: no viaja a cocina hasta que el mozo lo confirme.
        kdsStatus: KdsStatus.CART,
        modifiers: {
          create: elegidos.map((m) => ({ modifierId: m.id, name: m.name, priceDelta: m.priceDelta })),
        },
      },
    });

    // El carrito NO suma al total de la comanda: todavía no es un pedido.
    await tx.order.update({
      where: { id: comanda.id },
      data: { version: { increment: 1 } },
    });
  });

  return { ok: true };
}

export async function quitarDelCarrito(input: { token: string; itemId: string }): Promise<Resultado> {
  const limite = checkRateLimit(
    `carta:${input.token}`,
    LIMITE_CARTA_PUBLICA.maximo,
    LIMITE_CARTA_PUBLICA.ventanaMs,
  );
  if (!limite.permitido) return { ok: false, error: "Esperá unos segundos" };

  const mesa = await prisma.table.findFirst({
    where: { publicToken: input.token, deleted: false },
    select: { id: true },
  });
  if (!mesa) return { ok: false, error: "Este código de mesa ya no sirve" };

  // Solo se puede sacar lo que TODAVÍA está en el carrito: lo confirmado ya
  // está en cocina y no lo puede cancelar el cliente desde su teléfono.
  await prisma.orderItem.deleteMany({
    where: {
      id: input.itemId,
      kdsStatus: KdsStatus.CART,
      order: { tableId: mesa.id, status: OrderStatus.OPEN },
    },
  });

  return { ok: true };
}
