import { hash } from "bcryptjs";

import { BarberError, BarberErrorCode } from "./barber.errors";
import { findBarberManagementBranchById, updateBarber } from "./barber.repository";

export type UpdateBarberInput = {
  businessId: string;
  barberId: string;
  name: string;
  branchId: string;
  active: boolean;
  pin?: string;
};

export async function updateBarberForManagement(input: UpdateBarberInput) {
  const name = input.name.trim();
  const pin = input.pin?.trim();

  if (!name) {
    throw new BarberError(BarberErrorCode.NAME_REQUIRED);
  }

  if (pin !== undefined && pin.length > 0 && !isValidPin(pin)) {
    throw new BarberError(BarberErrorCode.INVALID_PIN_FORMAT);
  }

  const branch = await findBarberManagementBranchById(input.branchId, input.businessId);

  if (!branch) {
    throw new BarberError(BarberErrorCode.BRANCH_NOT_FOUND);
  }

  const pinHash = pin && pin.length > 0 ? await hash(pin, 12) : undefined;
  const result = await updateBarber({
    barberId: input.barberId,
    name,
    branchId: branch.id,
    businessId: branch.businessId,
    active: input.active,
    pinHash,
  });

  if (result.count === 0) {
    throw new BarberError(BarberErrorCode.BARBER_NOT_FOUND);
  }
}

function isValidPin(pin: string) {
  return /^\d{4,8}$/.test(pin);
}
