import { hash } from "bcryptjs";

import { StaffError, StaffErrorCode } from "./staff.errors";
import { updateStaffPinHash } from "./staff.repository";

export type UpdateStaffPinInput = {
  staffId: string;
  businessId: string;
  pin: string;
};

export async function updateStaffPin(input: UpdateStaffPinInput) {
  const pin = input.pin.trim();

  if (!/^\d{4,8}$/.test(pin)) {
    throw new StaffError(StaffErrorCode.INVALID_PIN_FORMAT);
  }

  const pinHash = await hash(pin, 12);
  const result = await updateStaffPinHash(input.staffId, input.businessId, pinHash);

  if (result.count === 0) {
    throw new StaffError(StaffErrorCode.STAFF_NOT_FOUND);
  }
}
