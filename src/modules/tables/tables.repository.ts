import { OrderStatus, TableStatus } from "@/generated/prisma/enums";
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
