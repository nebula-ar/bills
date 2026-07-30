import { compare } from "bcryptjs";

import { StaffError, StaffErrorCode } from "./staff.errors";
import { findActiveStaffForPinValidation } from "./staff.repository";

export type ValidateStaffPinInput = {
  staffId: string;
  pin: string;
  branchId?: string;
};

export async function validateStaffPin(input: ValidateStaffPinInput) {
  const pin = input.pin.trim();

  if (!isValidPin(pin)) {
    throw new StaffError(StaffErrorCode.INVALID_PIN_FORMAT);
  }

  const staff = await findActiveStaffForPinValidation(input.staffId, input.branchId);

  if (!staff) {
    throw new StaffError(StaffErrorCode.STAFF_NOT_FOUND);
  }

  if (!staff.pinHash) {
    throw new StaffError(StaffErrorCode.PIN_NOT_CONFIGURED);
  }

  const pinMatches = await compare(pin, staff.pinHash);

  if (!pinMatches) {
    throw new StaffError(StaffErrorCode.INVALID_PIN);
  }

  return { staffId: staff.id };
}

function isValidPin(pin: string) {
  return /^\d{4,8}$/.test(pin);
}
