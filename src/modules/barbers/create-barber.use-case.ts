import { hash } from "bcryptjs";

import { BarberError, BarberErrorCode } from "./barber.errors";
import { createBarber, findBarberManagementBranchById } from "./barber.repository";

export type CreateBarberInput = {
  name: string;
  branchId: string;
  pin: string;
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

  const branch = await findBarberManagementBranchById(input.branchId);

  if (!branch) {
    throw new BarberError(BarberErrorCode.BRANCH_NOT_FOUND);
  }

  const pinHash = await hash(pin, 12);

  return createBarber({
    name,
    branchId: branch.id,
    businessId: branch.businessId,
    pinHash,
  });
}

function isValidPin(pin: string) {
  return /^\d{4,8}$/.test(pin);
}
