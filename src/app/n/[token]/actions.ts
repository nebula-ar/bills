"use server";

import { getMarketingErrorMessage } from "@/lib/marketing-error-messages";
import { logError } from "@/lib/logger";
import { MarketingError } from "@/modules/marketing/marketing.errors";
import { createPublicBooking } from "@/modules/marketing/public-booking.use-case";
import { revalidatePath } from "next/cache";

export type BookingResult = { ok: true; timeLabel: string } | { ok: false; error: string };

const timeFormatter = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// Reserva pública. No hay sesión: todo se valida del lado del servidor (ver
// public-booking.use-case.ts).
export async function bookPublicAppointmentAction(input: {
  token: string;
  branchId: string;
  staffId?: string | null;
  productId?: string | null;
  // ISO del horario elegido, tal como salió de los slots que ofrecimos.
  startsAt: string;
  durationMinutes: number;
  customerName: string;
  customerPhone: string;
  notes?: string;
}): Promise<BookingResult> {
  try {
    const appointment = await createPublicBooking({
      token: input.token,
      branchId: input.branchId,
      staffId: input.staffId ?? null,
      productId: input.productId ?? null,
      startsAt: new Date(input.startsAt),
      durationMinutes: input.durationMinutes,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      notes: input.notes,
    });

    // La agenda del negocio y la propia página tienen que reflejarlo ya.
    revalidatePath("/turnos");
    revalidatePath(`/n/${input.token}`);

    return { ok: true, timeLabel: timeFormatter.format(appointment.startsAt) };
  } catch (error) {
    if (error instanceof MarketingError) {
      return { ok: false, error: getMarketingErrorMessage(error.code) };
    }

    await logError("marketing.booking.public", error, { context: { token: input.token } });
    return { ok: false, error: "No pudimos tomar la reserva. Probá de nuevo." };
  }
}
