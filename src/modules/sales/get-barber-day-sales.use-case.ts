import { findBarberSalesInRange } from "./sale.repository";

// Argentina es UTC-3 fijo (sin horario de verano).
const ARGENTINA_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function argentinaDayRange(now: Date) {
  const argentinaNow = new Date(now.getTime() - ARGENTINA_OFFSET_MS);
  const argentinaMidnightUtc = Date.UTC(
    argentinaNow.getUTCFullYear(),
    argentinaNow.getUTCMonth(),
    argentinaNow.getUTCDate(),
  );
  const start = new Date(argentinaMidnightUtc + ARGENTINA_OFFSET_MS);
  const end = new Date(start.getTime() + DAY_MS);
  return { start, end };
}

export async function getBarberDaySales(input: { branchId: string; barberId: string; now: Date }) {
  const { start, end } = argentinaDayRange(input.now);
  return findBarberSalesInRange({ branchId: input.branchId, barberId: input.barberId, start, end });
}
