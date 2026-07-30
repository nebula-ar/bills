import { hash } from "bcryptjs";

import { logEvent } from "@/lib/logger";

import { StaffError, StaffErrorCode } from "./staff.errors";
import { createStaff, findStaffManagementBranchById } from "./staff.repository";

export type CreateStaffInput = {
  businessId: string;
  name: string;
  branchId: string;
  pin: string;
  canCloseCash: boolean;
};

export async function createStaffForManagement(input: CreateStaffInput) {
  const name = input.name.trim();
  const pin = input.pin.trim();

  if (!name) {
    throw new StaffError(StaffErrorCode.NAME_REQUIRED);
  }

  if (!isValidPin(pin)) {
    throw new StaffError(StaffErrorCode.INVALID_PIN_FORMAT);
  }

  const branch = await findStaffManagementBranchById(input.branchId, input.businessId);

  if (!branch) {
    throw new StaffError(StaffErrorCode.BRANCH_NOT_FOUND);
  }

  const pinHash = await hash(pin, 12);

  const staff = await createStaff({
    name,
    branchId: branch.id,
    businessId: branch.businessId,
    pinHash,
    canCloseCash: input.canCloseCash,
  });

  await logEvent("staff.create", `Alta de empleado "${name}"`, {
    businessId: branch.businessId,
    context: { staffId: staff.id, branchId: branch.id, canCloseCash: input.canCloseCash },
  });

  return staff;
}

function isValidPin(pin: string) {
  return /^\d{4,8}$/.test(pin);
}
