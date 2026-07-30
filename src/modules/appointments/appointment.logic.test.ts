import { describe, expect, it } from "vitest";

import { availableSlots, endOf, findConflict, overlaps } from "./appointment.logic";

const at = (hour: number, minute = 0) => new Date(2026, 6, 28, hour, minute, 0, 0);

describe("overlaps", () => {
  it("dos turnos del mismo empleado que se pisan chocan", () => {
    expect(
      overlaps(
        { staffId: "a", startsAt: at(15), durationMinutes: 30 },
        { staffId: "a", startsAt: at(15, 15), durationMinutes: 30 },
      ),
    ).toBe(true);
  });

  it("turnos pegados no chocan", () => {
    expect(
      overlaps(
        { staffId: "a", startsAt: at(15), durationMinutes: 30 },
        { staffId: "a", startsAt: at(15, 30), durationMinutes: 30 },
      ),
    ).toBe(false);
  });

  it("dos empleados distintos pueden atender a la misma hora", () => {
    expect(
      overlaps(
        { staffId: "a", startsAt: at(15), durationMinutes: 30 },
        { staffId: "b", startsAt: at(15), durationMinutes: 30 },
      ),
    ).toBe(false);
  });

  it("un turno sin empleado asignado no bloquea la agenda de nadie", () => {
    expect(
      overlaps(
        { staffId: null, startsAt: at(15), durationMinutes: 30 },
        { staffId: "a", startsAt: at(15), durationMinutes: 30 },
      ),
    ).toBe(false);
  });

  it("un turno largo se come a uno corto", () => {
    expect(
      overlaps(
        { staffId: "a", startsAt: at(15), durationMinutes: 120 },
        { staffId: "a", startsAt: at(16), durationMinutes: 15 },
      ),
    ).toBe(true);
  });
});

describe("endOf", () => {
  it("suma la duración", () => {
    expect(endOf({ staffId: "a", startsAt: at(15), durationMinutes: 45 })).toEqual(at(15, 45));
  });
});

describe("findConflict", () => {
  const existing = [
    { id: "1", staffId: "a", startsAt: at(15), durationMinutes: 30 },
    { id: "2", staffId: "a", startsAt: at(17), durationMinutes: 30 },
  ];

  it("encuentra el turno que choca", () => {
    const conflict = findConflict({ staffId: "a", startsAt: at(15, 20), durationMinutes: 30 }, existing);
    expect(conflict?.id).toBe("1");
  });

  it("un hueco libre no choca", () => {
    expect(findConflict({ staffId: "a", startsAt: at(16), durationMinutes: 30 }, existing)).toBeNull();
  });

  it("al editar, un turno no choca consigo mismo", () => {
    const conflict = findConflict({ id: "1", staffId: "a", startsAt: at(15), durationMinutes: 30 }, existing, "1");
    expect(conflict).toBeNull();
  });
});

describe("availableSlots", () => {
  it("ofrece los bloques libres del día", () => {
    const slots = availableSlots({
      dayStart: at(9),
      dayEnd: at(11),
      stepMinutes: 30,
      durationMinutes: 30,
      staffId: "a",
      taken: [{ id: "1", staffId: "a", startsAt: at(9, 30), durationMinutes: 30 }],
    });

    expect(slots.map((slot) => slot.getHours() * 60 + slot.getMinutes())).toEqual([
      9 * 60,
      10 * 60,
      10 * 60 + 30,
    ]);
  });

  it("no ofrece un turno que termina después del cierre", () => {
    const slots = availableSlots({
      dayStart: at(9),
      dayEnd: at(10),
      stepMinutes: 30,
      durationMinutes: 45,
      staffId: "a",
      taken: [],
    });

    expect(slots).toHaveLength(1);
    expect(slots[0]).toEqual(at(9));
  });

  it("no ofrece horarios que ya pasaron", () => {
    const slots = availableSlots({
      dayStart: at(9),
      dayEnd: at(11),
      stepMinutes: 60,
      durationMinutes: 30,
      staffId: "a",
      taken: [],
      now: at(10, 1),
    });

    expect(slots).toHaveLength(0);
  });
});
