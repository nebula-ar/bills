// Lógica pura de la agenda. Lo que hay que hacer bien acá es no dejar que dos
// clientes caigan en el mismo horario con el mismo barbero: eso, en un local
// chico, significa una persona esperando parada y otra enojada.

export type TimeSlot = {
  id?: string;
  staffId: string | null;
  startsAt: Date;
  durationMinutes: number;
};

export function endOf(slot: TimeSlot): Date {
  return new Date(slot.startsAt.getTime() + slot.durationMinutes * 60_000);
}

// Dos turnos chocan si comparten al menos un minuto CON EL MISMO empleado.
// Turnos pegados (uno termina 15:00, el otro empieza 15:00) no chocan.
export function overlaps(a: TimeSlot, b: TimeSlot): boolean {
  // Sin empleado asignado no hay conflicto de agenda: es un turno "para
  // cualquiera", y quién lo toma se decide en el momento.
  if (!a.staffId || !b.staffId || a.staffId !== b.staffId) {
    return false;
  }

  return a.startsAt < endOf(b) && b.startsAt < endOf(a);
}

// Busca el primer turno existente que choque con el que se quiere agendar.
// `ignoreId` sirve al editar: un turno no choca consigo mismo.
export function findConflict(candidate: TimeSlot, existing: TimeSlot[], ignoreId?: string): TimeSlot | null {
  return existing.find((slot) => slot.id !== ignoreId && overlaps(candidate, slot)) ?? null;
}

// Horarios disponibles del día, en bloques regulares. Sirve para ofrecer
// "¿a qué hora?" sin que el usuario tenga que pensar en huecos.
export function availableSlots(input: {
  dayStart: Date;
  dayEnd: Date;
  stepMinutes: number;
  durationMinutes: number;
  staffId: string | null;
  taken: TimeSlot[];
  now?: Date;
}): Date[] {
  const slots: Date[] = [];
  const step = input.stepMinutes * 60_000;

  for (let time = input.dayStart.getTime(); time < input.dayEnd.getTime(); time += step) {
    const startsAt = new Date(time);

    // Un turno que termina después del cierre no entra.
    if (startsAt.getTime() + input.durationMinutes * 60_000 > input.dayEnd.getTime()) {
      break;
    }

    // No se ofrecen horarios que ya pasaron.
    if (input.now && startsAt < input.now) {
      continue;
    }

    const candidate = { staffId: input.staffId, startsAt, durationMinutes: input.durationMinutes };

    if (!findConflict(candidate, input.taken)) {
      slots.push(startsAt);
    }
  }

  return slots;
}

export const AppointmentErrorCode = {
  OVERLAP: "OVERLAP",
  INVALID_DURATION: "INVALID_DURATION",
  INVALID_DATE: "INVALID_DATE",
  MISSING_CUSTOMER: "MISSING_CUSTOMER",
  APPOINTMENT_NOT_FOUND: "APPOINTMENT_NOT_FOUND",
  BRANCH_NOT_FOUND: "BRANCH_NOT_FOUND",
  ALREADY_CHARGED: "ALREADY_CHARGED",
} as const;

export type AppointmentErrorCode = (typeof AppointmentErrorCode)[keyof typeof AppointmentErrorCode];

export class AppointmentError extends Error {
  constructor(
    public readonly code: AppointmentErrorCode,
    public readonly detail?: { conflictAt?: Date },
  ) {
    super(code);
    this.name = "AppointmentError";
  }
}
