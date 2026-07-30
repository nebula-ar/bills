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
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

// Une la fecha del día con la hora elegida, en horario local.
function combine(day: string, time: string): Date | null {
  const dayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(time);

  if (!dayMatch || !timeMatch) {
    return null;
  }

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

export async function createAppointmentAction(formData: FormData) {
  const { session } = await requireModule(AppModule.APPOINTMENTS);

  const day = text(formData, "day");
  const startsAt = combine(day, text(formData, "time"));
  const duration = Number(text(formData, "durationMinutes") || "30");

  if (!startsAt) {
    back(day, "error", "Elegí una fecha y hora válidas.");
  }

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
    handle(error, day, session.user.businessId, session.user.id);
  }

  back(day, "success", "Turno agendado.");
}

export async function setStatusAction(formData: FormData) {
  const { session } = await requireModule(AppModule.APPOINTMENTS);
  const day = text(formData, "day");
  const status = text(formData, "status");

  if (!(Object.values(AppointmentStatus) as string[]).includes(status)) {
    back(day, "error", "Ese estado no existe.");
  }

  try {
    await setAppointmentStatus({
      businessId: session.user.businessId,
      appointmentId: text(formData, "appointmentId"),
      status: status as AppointmentStatus,
      userId: session.user.id,
    });
  } catch (error) {
    handle(error, day, session.user.businessId, session.user.id);
  }

  back(day, "success", "Turno actualizado.");
}

export async function deleteAppointmentAction(formData: FormData) {
  const { session } = await requireModule(AppModule.APPOINTMENTS);
  const day = text(formData, "day");

  try {
    await deleteAppointment({
      businessId: session.user.businessId,
      appointmentId: text(formData, "appointmentId"),
      userId: session.user.id,
    });
  } catch (error) {
    handle(error, day, session.user.businessId, session.user.id);
  }

  back(day, "success", "Turno borrado.");
}

function handle(error: unknown, day: string, businessId: string, userId: string): never {
  if (error instanceof AppointmentError) {
    back(day, "error", message(error));
  }

  void logError("appointment", error, { businessId, userId });
  back(day, "error", "No pudimos completar la operación. Intentá de nuevo.");
}

function message(error: AppointmentError): string {
  switch (error.code) {
    case AppointmentErrorCode.OVERLAP: {
      const at = error.detail?.conflictAt;
      const hour = at ? at.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false }) : null;
      return hour
        ? `Se pisa con el turno de las ${hour}. Elegí otro horario.`
        : "Se pisa con otro turno. Elegí otro horario.";
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

function back(day: string, status: "success" | "error", message: string): never {
  // La acción acabó de mutar datos y el redirect vuelve a la MISMA ruta: sin
  // invalidarla, el router del cliente puede servir el árbol que ya tenía y el
  // usuario ve el valor de antes (visto de verdad: un ajuste de stock a 50 que
  // seguía mostrando 111).
  revalidatePath("/turnos");

  const params = new URLSearchParams({ status, message });
  if (day) params.set("day", day);
  redirect(`/turnos?${params.toString()}`);
}
