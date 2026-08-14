import { AppointmentStatus } from "@/generated/prisma/client";
import { logEvent } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

import { AppointmentError, AppointmentErrorCode, findConflict } from "./appointment.logic";

const APPOINTMENT_LIST_SELECT = {
  id: true,
  startsAt: true,
  durationMinutes: true,
  status: true,
  notes: true,
  customerName: true,
  customerPhone: true,
  customerId: true,
  saleId: true,
  branchId: true,
  staff: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true, phone: true } },
  product: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true } },
} as const;

// Agenda por rango: lo que necesita el Scheduler (NEBU-47) para pintar las
// vistas de día, semana y agenda sin ir a buscar turno por turno.
export async function getAppointmentsRange(input: { businessId: string; from: Date; to: Date; branchId?: string }) {
  return prisma.appointment.findMany({
    where: {
      businessId: input.businessId,
      deleted: false,
      startsAt: { gte: input.from, lte: input.to },
      ...(input.branchId ? { branchId: input.branchId } : {}),
    },
    orderBy: { startsAt: "asc" },
    select: APPOINTMENT_LIST_SELECT,
  });
}

// Agenda del día. Trae todo lo que la pantalla necesita para pintarse sin ir a
// buscar nada más: quién atiende, qué servicio y a quién.
export async function getDayAppointments(input: { businessId: string; branchId?: string | null; day: Date }) {
  return getAppointmentsRange({
    businessId: input.businessId,
    branchId: input.branchId ?? undefined,
    from: startOfDay(input.day),
    to: endOfDay(input.day),
  });
}

export type CreateAppointmentInput = {
  businessId: string;
  branchId: string;
  staffId?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  productId?: string | null;
  startsAt: Date;
  durationMinutes: number;
  notes?: string | null;
  userId?: string | null;
};

export async function createAppointment(input: CreateAppointmentInput) {
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes <= 0 || input.durationMinutes > 8 * 60) {
    throw new AppointmentError(AppointmentErrorCode.INVALID_DURATION);
  }

  if (Number.isNaN(input.startsAt.getTime())) {
    throw new AppointmentError(AppointmentErrorCode.INVALID_DATE);
  }

  // Hay que saber a quién se atiende: de la ficha o, al menos, un nombre.
  if (!input.customerId && !input.customerName?.trim()) {
    throw new AppointmentError(AppointmentErrorCode.MISSING_CUSTOMER);
  }

  const branch = await prisma.branch.findFirst({
    where: { id: input.branchId, businessId: input.businessId, deleted: false, active: true },
    select: { id: true },
  });

  if (!branch) {
    throw new AppointmentError(AppointmentErrorCode.BRANCH_NOT_FOUND);
  }

  await assertFree({
    businessId: input.businessId,
    staffId: input.staffId ?? null,
    startsAt: input.startsAt,
    durationMinutes: input.durationMinutes,
  });

  const appointment = await prisma.appointment.create({
    data: {
      businessId: input.businessId,
      branchId: branch.id,
      staffId: input.staffId ?? null,
      customerId: input.customerId ?? null,
      customerName: input.customerName?.trim() || null,
      customerPhone: input.customerPhone?.trim() || null,
      productId: input.productId ?? null,
      startsAt: input.startsAt,
      durationMinutes: input.durationMinutes,
      notes: input.notes?.trim() || null,
      createdById: input.userId,
    },
    select: { id: true, startsAt: true },
  });

  await logEvent("appointment.create", "Turno agendado", {
    businessId: input.businessId,
    userId: input.userId ?? undefined,
    context: { appointmentId: appointment.id, startsAt: appointment.startsAt.toISOString(), staffId: input.staffId },
  });

  return appointment;
}

export type UpdateAppointmentInput = {
  businessId: string;
  appointmentId: string;
  /** Solo si se cambia el horario (drag & drop o el editor). */
  startsAt?: Date;
  /** Solo si se cambia la duración (resize o el editor). */
  durationMinutes?: number;
  staffId?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  productId?: string | null;
  branchId?: string;
  notes?: string | null;
  userId?: string | null;
};

// Edición de un turno: cambia horario, duración, empleado, cliente, servicio,
// sucursal o nota sin tocar lo que no viene. Usa el mismo control de choques
// que el alta (ignorando el propio turno) para que moverlo con el Scheduler no
// termine con dos clientes en la misma silla.
export async function updateAppointment(input: UpdateAppointmentInput) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: input.appointmentId, businessId: input.businessId, deleted: false },
    select: {
      id: true,
      branchId: true,
      staffId: true,
      customerId: true,
      customerName: true,
      startsAt: true,
      durationMinutes: true,
      saleId: true,
    },
  });

  if (!appointment) {
    throw new AppointmentError(AppointmentErrorCode.APPOINTMENT_NOT_FOUND);
  }

  // Un turno cobrado no se mueve ni se edita: ya pasó a la caja.
  if (appointment.saleId) {
    throw new AppointmentError(AppointmentErrorCode.ALREADY_CHARGED);
  }

  const startsAt = input.startsAt ?? appointment.startsAt;
  const durationMinutes = input.durationMinutes ?? appointment.durationMinutes;

  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0 || durationMinutes > 8 * 60) {
    throw new AppointmentError(AppointmentErrorCode.INVALID_DURATION);
  }

  if (Number.isNaN(startsAt.getTime())) {
    throw new AppointmentError(AppointmentErrorCode.INVALID_DATE);
  }

  // Al editar también hay que saber a quién se atiende. Solo se valida si el
  // editor mandó los campos (el drag & drop no los manda y no debe tocar esto).
  if (input.customerId !== undefined || input.customerName !== undefined) {
    const customerId = input.customerId === undefined ? appointment.customerId : input.customerId;
    const customerName = input.customerName === undefined ? appointment.customerName : input.customerName;

    if (!customerId && !customerName?.trim()) {
      throw new AppointmentError(AppointmentErrorCode.MISSING_CUSTOMER);
    }
  }

  let branchId = appointment.branchId;
  if (input.branchId && input.branchId !== appointment.branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: input.branchId, businessId: input.businessId, deleted: false, active: true },
      select: { id: true },
    });

    if (!branch) {
      throw new AppointmentError(AppointmentErrorCode.BRANCH_NOT_FOUND);
    }
    branchId = branch.id;
  }

  const staffId = input.staffId === undefined ? appointment.staffId : input.staffId;

  await assertFree({
    businessId: input.businessId,
    staffId,
    startsAt,
    durationMinutes,
    ignoreId: appointment.id,
  });

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      ...(input.startsAt !== undefined ? { startsAt } : {}),
      ...(input.durationMinutes !== undefined ? { durationMinutes } : {}),
      staffId,
      ...(input.customerId !== undefined ? { customerId: input.customerId } : {}),
      ...(input.customerName !== undefined ? { customerName: input.customerName?.trim() || null } : {}),
      ...(input.customerPhone !== undefined ? { customerPhone: input.customerPhone?.trim() || null } : {}),
      ...(input.productId !== undefined ? { productId: input.productId } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      ...(input.branchId !== undefined ? { branchId } : {}),
    },
  });

  await logEvent("appointment.update", "Turno actualizado", {
    businessId: input.businessId,
    userId: input.userId ?? undefined,
    context: { appointmentId: appointment.id, startsAt: startsAt.toISOString(), staffId },
  });
}

export async function setAppointmentStatus(input: {
  businessId: string;
  appointmentId: string;
  status: AppointmentStatus;
  userId?: string | null;
}) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: input.appointmentId, businessId: input.businessId, deleted: false },
    select: { id: true },
  });

  if (!appointment) {
    throw new AppointmentError(AppointmentErrorCode.APPOINTMENT_NOT_FOUND);
  }

  await prisma.appointment.update({ where: { id: appointment.id }, data: { status: input.status } });

  await logEvent("appointment.status", `Turno marcado como ${input.status}`, {
    businessId: input.businessId,
    userId: input.userId ?? undefined,
    context: { appointmentId: appointment.id, status: input.status },
  });
}

export async function deleteAppointment(input: { businessId: string; appointmentId: string; userId?: string | null }) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: input.appointmentId, businessId: input.businessId, deleted: false },
    select: { id: true },
  });

  if (!appointment) {
    throw new AppointmentError(AppointmentErrorCode.APPOINTMENT_NOT_FOUND);
  }

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { deleted: true, deletedAt: new Date() },
  });
}

// Datos del turno para precargar el cobro: qué servicio, quién atiende y a quién.
// Es el "cobro en la silla": el barbero no vuelve a elegir nada.
export async function getAppointmentForCheckout(appointmentId: string, businessId: string) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, businessId, deleted: false },
    select: {
      id: true,
      branchId: true,
      staffId: true,
      customerId: true,
      productId: true,
      saleId: true,
      status: true,
    },
  });

  if (!appointment) {
    throw new AppointmentError(AppointmentErrorCode.APPOINTMENT_NOT_FOUND);
  }

  if (appointment.saleId) {
    throw new AppointmentError(AppointmentErrorCode.ALREADY_CHARGED);
  }

  return appointment;
}

// Al cobrar, el turno queda enlazado a la venta y pasa a atendido: así la agenda
// del día muestra qué se cobró y qué no.
export async function linkAppointmentToSale(input: {
  businessId: string;
  appointmentId: string;
  saleId: string;
  userId?: string | null;
}) {
  await prisma.appointment.updateMany({
    where: { id: input.appointmentId, businessId: input.businessId, deleted: false },
    data: { saleId: input.saleId, status: AppointmentStatus.DONE },
  });

  await logEvent("appointment.charged", "Turno cobrado", {
    businessId: input.businessId,
    userId: input.userId ?? undefined,
    context: { appointmentId: input.appointmentId, saleId: input.saleId },
  });
}

async function assertFree(input: {
  businessId: string;
  staffId: string | null;
  startsAt: Date;
  durationMinutes: number;
  ignoreId?: string;
}) {
  if (!input.staffId) {
    return;
  }

  // Se traen solo los turnos del día del empleado: alcanza para detectar choques
  // y evita recorrer la agenda entera.
  const sameDay = await prisma.appointment.findMany({
    where: {
      businessId: input.businessId,
      staffId: input.staffId,
      deleted: false,
      status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
      startsAt: { gte: startOfDay(input.startsAt), lte: endOfDay(input.startsAt) },
    },
    select: { id: true, staffId: true, startsAt: true, durationMinutes: true },
  });

  const conflict = findConflict(
    { staffId: input.staffId, startsAt: input.startsAt, durationMinutes: input.durationMinutes },
    sameDay,
    input.ignoreId,
  );

  if (conflict) {
    throw new AppointmentError(AppointmentErrorCode.OVERLAP, { conflictAt: conflict.startsAt });
  }
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}
