import { AppModule, AppointmentStatus } from "@/generated/prisma/client";
import { logEvent } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { findConflict } from "@/modules/appointments/appointment.logic";

import { MarketingError, MarketingErrorCode } from "./marketing.errors";
import { getPublicBusiness, getPublicDayAppointments } from "./marketing.use-cases";

// Reserva de turno desde la página pública.
//
// Acá no hay sesión: entra cualquiera con el link. Por eso todo se revalida en
// el servidor —el negocio, que la página esté prendida, que el módulo de turnos
// exista, que la sucursal sea de ese negocio y que el horario esté libre— y
// nada de lo que venga del navegador se toma por bueno.

// Cuánto para adelante se puede reservar. Sin tope, alguien agenda para 2030.
const MAX_DAYS_AHEAD = 60;

export type PublicBookingInput = {
  token: string;
  branchId: string;
  staffId?: string | null;
  productId?: string | null;
  startsAt: Date;
  durationMinutes: number;
  customerName: string;
  customerPhone: string;
  notes?: string | null;
  now?: Date;
};

export async function createPublicBooking(input: PublicBookingInput) {
  const now = input.now ?? new Date();
  const business = await getPublicBusiness(input.token);

  if (!business) {
    throw new MarketingError(MarketingErrorCode.PAGE_NOT_FOUND);
  }

  // Reservar turno requiere el módulo de turnos prendido: si el negocio lo
  // apagó, la página pública no puede seguir tomando reservas por la ventana
  // de atrás.
  const hasAppointments = await prisma.businessModuleAccess.findFirst({
    where: { businessId: business.id, module: AppModule.APPOINTMENTS },
    select: { id: true },
  });

  if (!hasAppointments) {
    throw new MarketingError(MarketingErrorCode.PAGE_NOT_FOUND);
  }

  const branch = business.branches.find((item) => item.id === input.branchId);

  if (!branch) {
    throw new MarketingError(MarketingErrorCode.INVALID_BOOKING);
  }

  const name = input.customerName.trim();
  const phone = input.customerPhone.trim();

  if (name.length < 2 || phone.replace(/\D/g, "").length < 6) {
    throw new MarketingError(MarketingErrorCode.INVALID_BOOKING);
  }

  if (Number.isNaN(input.startsAt.getTime()) || input.startsAt <= now) {
    throw new MarketingError(MarketingErrorCode.INVALID_BOOKING);
  }

  const limit = new Date(now);
  limit.setDate(limit.getDate() + MAX_DAYS_AHEAD);

  if (input.startsAt > limit) {
    throw new MarketingError(MarketingErrorCode.INVALID_BOOKING);
  }

  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes <= 0 || input.durationMinutes > 8 * 60) {
    throw new MarketingError(MarketingErrorCode.INVALID_BOOKING);
  }

  // El staff y el servicio tienen que ser de este negocio: el id viaja por el
  // formulario y cualquiera puede cambiarlo.
  const staffId = input.staffId
    ? (
        await prisma.user.findFirst({
          where: { id: input.staffId, businessId: business.id, branchId: branch.id, deleted: false, active: true },
          select: { id: true },
        })
      )?.id ?? null
    : null;

  const productId = input.productId
    ? (
        await prisma.product.findFirst({
          where: { id: input.productId, businessId: business.id, deleted: false, active: true },
          select: { id: true },
        })
      )?.id ?? null
    : null;

  const existing = await getPublicDayAppointments(business.id, branch.id, input.startsAt);

  const conflict = findConflict(
    { staffId, startsAt: input.startsAt, durationMinutes: input.durationMinutes },
    existing.map((appointment) => ({
      id: `${appointment.staffId}-${appointment.startsAt.getTime()}`,
      staffId: appointment.staffId,
      startsAt: appointment.startsAt,
      durationMinutes: appointment.durationMinutes,
    })),
  );

  if (conflict) {
    throw new MarketingError(MarketingErrorCode.BOOKING_UNAVAILABLE);
  }

  const appointment = await prisma.appointment.create({
    data: {
      businessId: business.id,
      branchId: branch.id,
      staffId,
      productId,
      customerName: name,
      customerPhone: phone,
      startsAt: input.startsAt,
      durationMinutes: input.durationMinutes,
      status: AppointmentStatus.SCHEDULED,
      // Queda marcado de dónde salió: el negocio tiene que saber que este turno
      // lo cargó el cliente y no alguien del mostrador.
      notes: [input.notes?.trim(), "Reservado desde la página pública"].filter(Boolean).join(" · "),
    },
    select: { id: true, startsAt: true },
  });

  await logEvent("marketing.booking.public", `Turno reservado por ${name}`, {
    businessId: business.id,
    context: { appointmentId: appointment.id, branchId: branch.id, staffId },
  });

  return appointment;
}
