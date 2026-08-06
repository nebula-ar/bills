"use server";

import { AppModule, AppointmentStatus } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { logError } from "@/lib/logger";
import { AppointmentError, AppointmentErrorCode } from "@/modules/appointments/appointment.logic";
import {
  createAppointment,
  deleteAppointment,
  setAppointmentStatus,
} from "@/modules/appointments/appointment.use-cases";

export type AppointmentActionResult = { ok: boolean; message: string };

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function combine(day: string, time: string): Date | null {
  const dayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(time);

  if (!dayMatch || !timeMatch) return null;

  return new Date(
    Number(dayMatch[1]),
    Number(dayMatch[2]) - 1,
    Number(dayMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
    0,
    0,
  );
}

// Las acciones de agenda se consumen desde componentes cliente. Devuelven el
// resultado para que la vista pueda dar feedback y refrescar el árbol actual;
// un redirect a esta misma ruta deja la navegación de Server Actions pendiente.
export async function createAppointmentAction(formData: FormData): Promise<AppointmentActionResult> {
  const { session } = await requireModule(AppModule.APPOINTMENTS);
  const startsAt = combine(text(formData, "day"), text(formData, "time"));
  const duration = Number(text(formData, "durationMinutes") || "30");

  if (!startsAt) return { ok: false, message: "Elegí una fecha y hora válidas." };

  try {
    await createAppointment({
      businessId: session.user.businessId,
      branchId: text(formData, "branchId"),
      staffId: text(formData, "staffId") || null,
      customerId: text(formData, "customerId") || null,
      customerName: text(formData, "customerName") || null,
      customerPhone: text(formData, "customerPhone") || null,
      productId: text(formData, "productId") || null,
      startsAt,
      durationMinutes: Number.isFinite(duration) ? Math.round(duration) : 30,
      notes: text(formData, "notes") || null,
      userId: session.user.id,
    });
  } catch (error) {
    return handle(error, session.user.businessId, session.user.id);
  }

  return { ok: true, message: "Turno agendado." };
}

export async function setStatusAction(formData: FormData): Promise<AppointmentActionResult> {
  const { session } = await requireModule(AppModule.APPOINTMENTS);
  const status = text(formData, "status");

  if (!(Object.values(AppointmentStatus) as string[]).includes(status)) {
    return { ok: false, message: "Ese estado no existe." };
  }

  try {
    await setAppointmentStatus({
      businessId: session.user.businessId,
      appointmentId: text(formData, "appointmentId"),
      status: status as AppointmentStatus,
      userId: session.user.id,
    });
  } catch (error) {
    return handle(error, session.user.businessId, session.user.id);
  }

  return { ok: true, message: "Turno actualizado." };
}

export async function deleteAppointmentAction(formData: FormData): Promise<AppointmentActionResult> {
  const { session } = await requireModule(AppModule.APPOINTMENTS);

  try {
    await deleteAppointment({
      businessId: session.user.businessId,
      appointmentId: text(formData, "appointmentId"),
      userId: session.user.id,
    });
  } catch (error) {
    return handle(error, session.user.businessId, session.user.id);
  }

  return { ok: true, message: "Turno borrado." };
}

// Compatibilidad con formularios HTML que todavía se renderizan en el servidor.
// Las variantes con resultado son las que usan los formularios cliente.
export async function setStatusFormAction(formData: FormData): Promise<void> {
  await setStatusAction(formData);
}

export async function deleteAppointmentFormAction(formData: FormData): Promise<void> {
  await deleteAppointmentAction(formData);
}

async function handle(error: unknown, businessId: string, userId: string): Promise<AppointmentActionResult> {
  if (error instanceof AppointmentError) return { ok: false, message: message(error) };

  await logError("appointment", error, { businessId, userId });
  return { ok: false, message: "No pudimos completar la operación. Intentá de nuevo." };
}

function message(error: AppointmentError): string {
  switch (error.code) {
    case AppointmentErrorCode.OVERLAP: {
      const at = error.detail?.conflictAt;
      const hour = at ? at.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false }) : null;
      return hour ? `Se pisa con el turno de las ${hour}. Elegí otro horario.` : "Se pisa con otro turno. Elegí otro horario.";
    }
    case AppointmentErrorCode.MISSING_CUSTOMER:
      return "Poné el nombre de quien viene.";
    case AppointmentErrorCode.INVALID_DURATION:
      return "La duración tiene que estar entre 1 minuto y 8 horas.";
    case AppointmentErrorCode.INVALID_DATE:
      return "Elegí una fecha y hora válidas.";
    case AppointmentErrorCode.BRANCH_NOT_FOUND:
      return "No encontramos la sucursal.";
    case AppointmentErrorCode.ALREADY_CHARGED:
      return "Ese turno ya se cobró.";
    default:
      return "No encontramos el turno.";
  }
}
