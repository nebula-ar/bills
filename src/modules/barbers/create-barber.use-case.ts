import { hash } from "bcryptjs";

import { logEvent } from "@/lib/logger";

import { BarberError, BarberErrorCode } from "./barber.errors";
import { createBarber, findBarberManagementBranchById } from "./barber.repository";

export type CreateBarberInput = {
  businessId: string;
  name: string;
  branchId: string;
  pin: string;
  canCloseCash: boolean;
};

export async function createBarberForManagement(input: CreateBarberInput) {
  const name = input.name.trim();
  const pin = input.pin.trim();

  if (!name) {
    throw new BarberError(BarberErrorCode.NAME_REQUIRED);
  }

  if (!isValidPin(pin)) {
    throw new BarberError(BarberErrorCode.INVALID_PIN_FORMAT);
  }

  const branch = await findBarberManagementBranchById(input.branchId, input.businessId);

  if (!branch) {
    throw new BarberError(BarberErrorCode.BRANCH_NOT_FOUND);
  }

  const pinHash = await hash(pin, 12);

  const barber = await createBarber({
    name,
    branchId: branch.id,
    businessId: branch.businessId,
    pinHash,
    canCloseCash: input.canCloseCash,
  });

  await logEvent("barber.create", `Alta de barbero "${name}"`, {
    businessId: branch.businessId,
    context: { barberId: barber.id, branchId: branch.id, canCloseCash: input.canCloseCash },
  });

  return barber;
}

function isValidPin(pin: string) {
  return /^\d{4,8}$/.test(pin);
}
