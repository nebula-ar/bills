import { AppointmentStatus } from "@/generated/prisma/client";
import { logEvent } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

import { AppointmentError, AppointmentErrorCode, findConflict } from "./appointment.logic";

// Agenda del día. Trae todo lo que la pantalla necesita para pintarse sin ir a
// buscar nada más: quién atiende, qué servicio y a quién.
export async function getDayAppointments(input: { businessId: string; branchId?: string | null; day: Date }) {
  const from = startOfDay(input.day);
  const to = endOfDay(input.day);

  return prisma.appointment.findMany({
    where: {
      businessId: input.businessId,
      deleted: false,
      startsAt: { gte: from, lte: to },
      ...(input.branchId ? { branchId: input.branchId } : {}),
    },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      startsAt: true,
      durationMinutes: true,
      status: true,
      notes: true,
      customerName: true,
      customerPhone: true,
      saleId: true,
      staff: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true, phone: true } },
      product: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
    },
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
