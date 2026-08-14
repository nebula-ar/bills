// Tipos y constantes compartidos entre el server component, las server actions
// y el cliente del Scheduler de Turnos (NEBU-47). Solo tipos + constantes
// livianas: nada de esto importa código server-only, así puede viajar al
// browser sin arrastrar Prisma ni el resto del backend.

export type AppointmentStatusValue = "SCHEDULED" | "CONFIRMED" | "DONE" | "CANCELLED" | "NO_SHOW";

export const STATUS_LABELS: Record<AppointmentStatusValue, string> = {
  SCHEDULED: "Anotado",
  CONFIRMED: "Confirmado",
  DONE: "Atendido",
  CANCELLED: "Cancelado",
  NO_SHOW: "No vino",
};

export const STATUS_TONES: Record<AppointmentStatusValue, "info" | "positive" | "neutral" | "danger" | "warning"> = {
  SCHEDULED: "info",
  CONFIRMED: "positive",
  DONE: "neutral",
  CANCELLED: "danger",
  NO_SHOW: "warning",
};

// Un turno listo para viajar entre server y cliente (fechas en ISO). El nombre
// del cliente ya viene resuelto (ficha o escrito a mano) igual que la pantalla
// vieja, y el empleado/servicio como texto para pintar sin join de más.
export type TurnoEventData = {
  id: string;
  startsAt: string;
  durationMinutes: number;
  status: AppointmentStatusValue;
  notes: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerId: string | null;
  saleId: string | null;
  staffId: string | null;
  staffName: string | null;
  productId: string | null;
  productName: string | null;
  branchId: string;
};

// Datos de referencia para el editor del Scheduler: empleados, clientes,
// servicios y sucursales activas del negocio.
export type TurnoReferenceData = {
  branches: { id: string; name: string }[];
  staffs: { id: string; name: string }[];
  customers: { id: string; name: string }[];
  products: { id: string; name: string }[];
  staffLabel: string;
  productLabel: string;
};
