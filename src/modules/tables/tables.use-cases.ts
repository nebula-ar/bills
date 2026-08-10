import { randomUUID } from "node:crypto";

import { TableStatus } from "@/generated/prisma/enums";

import {
  createSector,
  createTable,
  findSectorByName,
  findTableByName,
  findTableForManage,
  getSectorsWithTables,
  getTablesWithoutSector,
  setTableStatus,
  softDeleteSector,
  softDeleteTable,
  updateSector,
  updateTable,
} from "./tables.repository";

/**
 * El salón visto desde el mostrador: sectores con sus mesas, y qué está pasando
 * en cada una.
 */

export type MesaEnTablero = {
  id: string;
  name: string;
  seats: number;
  status: TableStatus;
  /** Comanda abierta, si la hay. */
  comanda: { id: string; total: number; abiertaDesde: Date; items: number } | null;
};

export type SectorEnTablero = {
  id: string | null;
  name: string;
  mesas: MesaEnTablero[];
};

const aMesa = (t: {
  id: string;
  name: string;
  seats: number;
  status: TableStatus;
  orders: { id: string; total: number; openedAt: Date; items: { id: string }[] }[];
}): MesaEnTablero => {
  const abierta = t.orders[0];

  return {
    id: t.id,
    name: t.name,
    seats: t.seats,
    status: t.status,
    comanda: abierta
      ? { id: abierta.id, total: abierta.total, abiertaDesde: abierta.openedAt, items: abierta.items.length }
      : null,
  };
};

export async function getTablero(businessId: string, branchId: string): Promise<SectorEnTablero[]> {
  const [sectores, huerfanas] = await Promise.all([
    getSectorsWithTables(businessId, branchId),
    getTablesWithoutSector(businessId, branchId),
  ]);

  const tablero: SectorEnTablero[] = sectores.map((s) => ({
    id: s.id,
    name: s.name,
    mesas: s.tables.map(aMesa),
  }));

  // Las mesas sin sector no se esconden: existirían si alguien borró el sector
  // que las contenía, y una mesa invisible es una mesa que no se cobra.
  if (huerfanas.length > 0) {
    tablero.push({ id: null, name: "Sin sector", mesas: huerfanas.map(aMesa) });
  }

  return tablero;
}

export type Resultado = { ok: true } | { ok: false; error: string };

export async function crearSector(input: {
  businessId: string;
  branchId: string;
  name: string;
  userId: string;
}): Promise<Resultado & { sectorId?: string }> {
  const name = input.name.trim();

  if (!name) return { ok: false, error: "Poné un nombre para el sector" };
  if (name.length > 40) return { ok: false, error: "El nombre es muy largo" };

  if (await findSectorByName(input.businessId, input.branchId, name)) {
    return { ok: false, error: `Ya existe un sector "${name}"` };
  }

  const sector = await createSector({ ...input, name });

  return { ok: true, sectorId: sector.id };
}

export async function crearMesa(input: {
  businessId: string;
  branchId: string;
  sectorId: string | null;
  name: string;
  seats: number;
  userId: string;
}): Promise<Resultado & { mesaId?: string }> {
  const name = input.name.trim();

  if (!name) return { ok: false, error: "Poné un nombre o número para la mesa" };
  if (!Number.isInteger(input.seats) || input.seats < 1 || input.seats > 40) {
    return { ok: false, error: "Los lugares tienen que ser un número de 1 a 40" };
  }

  // El nombre de la mesa es lo que el mozo canta en voz alta: dos "Mesa 4" en
  // el mismo local es una comanda que termina en la mesa equivocada.
  if (await findTableByName(input.businessId, input.branchId, name)) {
    return { ok: false, error: `Ya hay una mesa "${name}" en esta sucursal` };
  }

  const tabla = await createTable({
    ...input,
    name,
    // Aleatorio y largo: el token ES la credencial de la carta pública, no hay
    // otra cosa que autentique a quien escanea.
    publicToken: randomUUID().replace(/-/g, ""),
  });

  return { ok: true, mesaId: tabla.id };
}

/**
 * Sentar o levantar gente sin cargar nada.
 *
 * Una mesa con comanda abierta NO se libera desde acá: hay que cobrarla o
 * cancelarla. Si no, la comanda queda viva y sin mesa que la muestre.
 */
export async function alternarOcupacion(input: {
  tableId: string;
  status: TableStatus;
  tieneComandaAbierta: boolean;
  userId: string;
}): Promise<Resultado> {
  if (input.tieneComandaAbierta && input.status !== TableStatus.OCCUPIED) {
    return { ok: false, error: "La mesa tiene una comanda abierta: cobrala o cancelala primero" };
  }

  const siguiente =
    input.status === TableStatus.OCCUPIED ? TableStatus.FREE : TableStatus.OCCUPIED;

  await setTableStatus(input.tableId, siguiente, input.userId);

  return { ok: true };
}

export async function editarMesa(input: {
  tableId: string;
  businessId: string;
  branchId: string;
  sectorId: string | null;
  name: string;
  seats: number;
  userId: string;
}): Promise<Resultado> {
  const name = input.name.trim();

  if (!name) return { ok: false, error: "Poné un nombre o número para la mesa" };
  if (!Number.isInteger(input.seats) || input.seats < 1 || input.seats > 40) {
    return { ok: false, error: "Los lugares tienen que ser un número de 1 a 40" };
  }

  // Único nombre por sucursal, salvo contra sí misma: si no, la mesa que se
  // edita choca con su propio nombre de antes.
  const existente = await findTableByName(input.businessId, input.branchId, name);
  if (existente && existente.id !== input.tableId) {
    return { ok: false, error: `Ya hay una mesa "${name}" en esta sucursal` };
  }

  await updateTable({ tableId: input.tableId, name, seats: input.seats, sectorId: input.sectorId, userId: input.userId });

  return { ok: true };
}

/**
 * Elimina una mesa (soft-delete).
 *
 * Bloqueada si está ocupada o tiene comanda abierta: borrarla ahí no borra la
 * plata que hay sentada, solo la esconde. Libérala o cobrala primero, mismo
 * criterio que `alternarOcupacion`.
 */
export async function eliminarMesa(input: { tableId: string; userId: string }): Promise<Resultado> {
  const mesa = await findTableForManage(input.tableId);
  if (!mesa) return { ok: false, error: "Esa mesa ya no existe" };

  if (mesa.status === TableStatus.OCCUPIED || mesa.orders.length > 0) {
    return { ok: false, error: "La mesa está ocupada: liberala antes de eliminarla" };
  }

  await softDeleteTable({ tableId: input.tableId, userId: input.userId });

  return { ok: true };
}

export async function editarSector(input: {
  sectorId: string;
  businessId: string;
  branchId: string;
  name: string;
  userId: string;
}): Promise<Resultado> {
  const name = input.name.trim();

  if (!name) return { ok: false, error: "Poné un nombre para el sector" };
  if (name.length > 40) return { ok: false, error: "El nombre es muy largo" };

  const existente = await findSectorByName(input.businessId, input.branchId, name);
  if (existente && existente.id !== input.sectorId) {
    return { ok: false, error: `Ya existe un sector "${name}"` };
  }

  await updateSector({ sectorId: input.sectorId, name, userId: input.userId });

  return { ok: true };
}

/**
 * Elimina un sector (soft-delete). Sus mesas NO se tocan: quedan sueltas,
 * "sin sector", para no volverse invisibles (ver `softDeleteSector`).
 */
export async function eliminarSector(input: {
  sectorId: string;
  businessId: string;
  branchId: string;
  userId: string;
}): Promise<Resultado> {
  await softDeleteSector(input);

  return { ok: true };
}
