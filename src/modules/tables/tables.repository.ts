import { KdsStatus, OrderStatus, TableStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

/**
 * Lectura y escritura del salón. Sin reglas de negocio: eso vive en
 * `order-lifecycle.ts`, que se prueba solo.
 */

export function getSectorsWithTables(businessId: string, branchId: string) {
  return prisma.sector.findMany({
    where: { businessId, branchId, deleted: false },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      sortOrder: true,
      tables: {
        where: { deleted: false },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          seats: true,
          status: true,
          orders: {
            where: { status: OrderStatus.OPEN, deleted: false },
            select: { id: true, total: true, openedAt: true, items: { select: { id: true } } },
            take: 1,
          },
        },
      },
    },
  });
}

/**
 * Mesas para elegir al cobrar en el mostrador: id, nombre y sector, nada más.
 *
 * No trae la comanda abierta ni el estado como `getSectorsWithTables`, porque
 * acá no se está atendiendo la mesa: se está diciendo a qué mesa fue lo que ya
 * se cobró. Traer la comanda invitaría a confundir los dos flujos.
 */
export function findMesasParaCobrar(businessId: string, branchId: string) {
  return prisma.table.findMany({
    where: { businessId, branchId, deleted: false },
    orderBy: [{ sector: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, sector: { select: { name: true } } },
  });
}

/**
 * Las mesas de la sucursal, cada una con su comanda abierta si la tiene.
 *
 * Es el detalle que `resumenDeMesasAbiertas` deliberadamente NO trae. Las dos
 * conviven porque contestan preguntas distintas: aquélla es el aviso del
 * mostrador ("¿queda algo sin cerrar antes de irme?"), ésta es el selector de
 * mesa del POS, donde hay que elegir una y para eso hace falta ver cuánto tiene
 * cada una y quién la está atendiendo.
 *
 * Dos consultas y no un `include`: las mesas libres no tienen comanda, así que
 * un join las dejaría afuera o traería filas en null. Se cruzan en memoria, que
 * con las mesas de un salón es gratis.
 */
export async function mesasConComanda(businessId: string, branchId: string) {
  const [mesas, comandas] = await Promise.all([
    prisma.table.findMany({
      where: { businessId, branchId, deleted: false },
      orderBy: [{ sector: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, sector: { select: { name: true } } },
    }),
    prisma.order.findMany({
      where: {
        businessId,
        branchId,
        status: OrderStatus.OPEN,
        deleted: false,
        tableId: { not: null },
      },
      select: {
        id: true,
        tableId: true,
        total: true,
        staffId: true,
        openedAt: true,
        _count: { select: { items: true } },
      },
    }),
  ]);

  // Cuántos renglones quedaron en borrador por comanda.
  //
  // Va aparte y no como `_count` filtrado para que quede a la vista lo que
  // significa: `kdsStatus: CART` es lo que se cargó y TODAVÍA NO se mandó a
  // cocina. El total de la comanda no lo suma —un borrador no se pidió, y
  // cobrarlo sería cobrar algo que la cocina nunca vio—, así que una mesa puede
  // mostrar $0 y tener tres platos esperando. Sin este número, esa mesa se ve
  // igual que una vacía.
  const pendientesPorComanda =
    comandas.length === 0
      ? []
      : await prisma.orderItem.groupBy({
          by: ["orderId"],
          where: { orderId: { in: comandas.map((comanda) => comanda.id) }, kdsStatus: KdsStatus.CART },
          _count: { _all: true },
        });
  const pendientes = new Map(pendientesPorComanda.map((fila) => [fila.orderId, fila._count._all]));

  const porMesa = new Map(comandas.map((comanda) => [comanda.tableId, comanda]));
  // Una sola lectura del reloj para todas: si cada mesa tomara la suya, dos
  // abiertas en el mismo minuto podrían mostrar minutos distintos.
  const ahora = Date.now();

  return mesas.map((mesa) => {
    const comanda = porMesa.get(mesa.id);
    return {
      id: mesa.id,
      name: mesa.name,
      sector: mesa.sector?.name ?? null,
      comanda: comanda
        ? {
            orderId: comanda.id,
            total: comanda.total,
            items: comanda._count.items,
            // El mozo de la mesa. Al elegirla, el POS pasa a vender como él:
            // la comisión es de quien atendió, no de quien apretó cobrar.
            staffId: comanda.staffId,
            pendientes: pendientes.get(comanda.id) ?? 0,
            // Los minutos se calculan ACÁ y no en la pantalla. Dos motivos: un
            // `Date.now()` por teléfono daría un número distinto en cada uno
            // según su reloj, y en un componente de React es una función impura
            // en pleno render (lo marca el linter, con razón).
            minutosAbierta: Math.max(0, Math.round((ahora - comanda.openedAt.getTime()) / 60_000)),
          }
        : null,
    };
  });
}

/**
 * Cuánta plata hay sentada en el salón: comandas abiertas y su total.
 *
 * Es para el atajo del mostrador. Un agregado y no las comandas enteras: el que
 * está por cobrar no necesita el detalle, necesita saber si hay algo sin cerrar
 * antes de irse. Solo cuenta las que están en una mesa; el mostrador y el
 * takeaway se cobran en el acto y nunca quedan abiertos.
 */
export async function resumenDeMesasAbiertas(businessId: string, branchId: string) {
  const abierto = await prisma.order.aggregate({
    where: {
      businessId,
      branchId,
      status: OrderStatus.OPEN,
      deleted: false,
      tableId: { not: null },
    },
    _count: { _all: true },
    _sum: { total: true },
  });

  return { mesas: abierto._count._all, total: abierto._sum.total ?? 0 };
}

/** Mesas sin sector: existen si alguien borró el sector que las contenía. */
export function getTablesWithoutSector(businessId: string, branchId: string) {
  return prisma.table.findMany({
    where: { businessId, branchId, sectorId: null, deleted: false },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      seats: true,
      status: true,
      orders: {
        where: { status: OrderStatus.OPEN, deleted: false },
        select: { id: true, total: true, openedAt: true, items: { select: { id: true } } },
        take: 1,
      },
    },
  });
}

/**
 * Crea un sector al FINAL de la lista.
 *
 * El `sortOrder` se calcula, no se deja en cero. Con todos empatados en 0 el
 * orden queda indefinido: la mesa que se cree a continuación cae en un sector
 * arbitrario en vez de en el que el usuario está mirando. Ese bug ya se vivió.
 */
export async function createSector(input: { businessId: string; branchId: string; name: string; userId: string }) {
  const ultimo = await prisma.sector.findFirst({
    where: { businessId: input.businessId, branchId: input.branchId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  return prisma.sector.create({
    data: {
      businessId: input.businessId,
      branchId: input.branchId,
      name: input.name,
      sortOrder: (ultimo?.sortOrder ?? 0) + 1,
      createdById: input.userId,
    },
    select: { id: true },
  });
}

export async function createTable(input: {
  businessId: string;
  branchId: string;
  sectorId: string | null;
  name: string;
  seats: number;
  publicToken: string;
  userId: string;
}) {
  const ultima = await prisma.table.findFirst({
    where: { businessId: input.businessId, branchId: input.branchId, sectorId: input.sectorId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  return prisma.table.create({
    data: {
      businessId: input.businessId,
      branchId: input.branchId,
      sectorId: input.sectorId,
      name: input.name,
      seats: input.seats,
      sortOrder: (ultima?.sortOrder ?? 0) + 1,
      // El QR se genera con la mesa: pedirle al dueño un paso extra para
      // "activar el QR" es una pantalla más que nadie va a encontrar.
      publicToken: input.publicToken,
      createdById: input.userId,
    },
    select: { id: true },
  });
}

export function findTableByName(businessId: string, branchId: string, name: string) {
  return prisma.table.findFirst({
    where: { businessId, branchId, name, deleted: false },
    select: { id: true },
  });
}

export function findSectorByName(businessId: string, branchId: string, name: string) {
  return prisma.sector.findFirst({
    where: { businessId, branchId, name, deleted: false },
    select: { id: true },
  });
}

/** Libera u ocupa una mesa (sentar gente sin cargar nada todavía). */
export function setTableStatus(tableId: string, status: TableStatus, userId: string) {
  return prisma.table.update({
    where: { id: tableId },
    data: { status, updatedById: userId },
    select: { id: true },
  });
}

/** Las mesas con su QR, para imprimirlos. */
export function findTokensDeMesas(businessId: string, branchId: string) {
  return prisma.table.findMany({
    where: { businessId, branchId, deleted: false },
    orderBy: [{ sector: { sortOrder: "asc" } }, { name: "asc" }],
    select: { id: true, name: true, publicToken: true, sector: { select: { name: true } } },
  });
}

/** Lo que hace falta para decidir si una mesa se puede eliminar. */
export function findTableForManage(tableId: string) {
  return prisma.table.findFirst({
    where: { id: tableId, deleted: false },
    select: {
      status: true,
      orders: { where: { status: OrderStatus.OPEN, deleted: false }, select: { id: true }, take: 1 },
    },
  });
}

export function updateTable(input: {
  tableId: string;
  name: string;
  seats: number;
  sectorId: string | null;
  userId: string;
}) {
  return prisma.table.update({
    where: { id: input.tableId },
    data: { name: input.name, seats: input.seats, sectorId: input.sectorId, updatedById: input.userId },
    select: { id: true },
  });
}

export function softDeleteTable(input: { tableId: string; userId: string }) {
  return prisma.table.update({
    where: { id: input.tableId },
    data: { deleted: true, deletedAt: new Date(), deletedById: input.userId },
    select: { id: true },
  });
}

export function updateSector(input: { sectorId: string; name: string; userId: string }) {
  return prisma.sector.update({
    where: { id: input.sectorId },
    data: { name: input.name, updatedById: input.userId },
    select: { id: true },
  });
}

/**
 * Borra el sector y suelta sus mesas a "sin sector", en la misma transacción.
 *
 * No las borra ni las deja apuntando a un sector que ya no existe (por eso
 * es una transacción y no dos escrituras sueltas): una mesa invisible es una
 * mesa que no se cobra, mismo criterio que ya vale para `getTablesWithoutSector`.
 */
export function softDeleteSector(input: { sectorId: string; businessId: string; branchId: string; userId: string }) {
  return prisma.$transaction([
    prisma.table.updateMany({
      where: { sectorId: input.sectorId, businessId: input.businessId, branchId: input.branchId, deleted: false },
      data: { sectorId: null, updatedById: input.userId },
    }),
    prisma.sector.update({
      where: { id: input.sectorId },
      data: { deleted: true, deletedAt: new Date(), deletedById: input.userId },
    }),
  ]);
}
