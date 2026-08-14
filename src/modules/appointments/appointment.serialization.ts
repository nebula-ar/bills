// Serialización de turnos entre server y cliente. Vive fuera de las server
// actions ("use server" solo exporta acciones) para que el page.tsx y las
// acciones compartan el mismo mapeo: nombres resueltos y fechas en ISO para
// que viajen en JSON sin perder la zona horaria.

import type { TurnoEventData } from "@/app/turnos/types";
import type { getAppointmentsRange } from "@/modules/appointments/appointment.use-cases";

export function serializeAppointment(row: Awaited<ReturnType<typeof getAppointmentsRange>>[number]): TurnoEventData {
  return {
    id: row.id,
    startsAt: row.startsAt.toISOString(),
    durationMinutes: row.durationMinutes,
    status: row.status,
    notes: row.notes,
    customerName: row.customer?.name ?? row.customerName ?? null,
    customerPhone: row.customer?.phone ?? row.customerPhone,
    customerId: row.customerId,
    saleId: row.saleId,
    staffId: row.staff?.id ?? null,
    staffName: row.staff?.name ?? null,
    productId: row.product?.id ?? null,
    productName: row.product?.name ?? null,
    branchId: row.branchId,
  };
}
