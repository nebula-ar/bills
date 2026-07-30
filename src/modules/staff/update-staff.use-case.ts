import { hash } from "bcryptjs";

import { StaffError, StaffErrorCode } from "./staff.errors";
import { findStaffManagementBranchById, updateStaff } from "./staff.repository";

export type UpdateStaffInput = {
  businessId: string;
  staffId: string;
  name: string;
  branchId: string;
  active: boolean;
  canCloseCash: boolean;
  // Porcentaje de comisión (0-100). Solo se usa con el módulo prendido.
  commissionRate?: number;
  pin?: string;
};

export async function updateStaffForManagement(input: UpdateStaffInput) {
  const name = input.name.trim();
  const pin = input.pin?.trim();

  if (!name) {
    throw new StaffError(StaffErrorCode.NAME_REQUIRED);
  }

  if (pin !== undefined && pin.length > 0 && !isValidPin(pin)) {
    throw new StaffError(StaffErrorCode.INVALID_PIN_FORMAT);
  }

  const branch = await findStaffManagementBranchById(input.branchId, input.businessId);

  if (!branch) {
    throw new StaffError(StaffErrorCode.BRANCH_NOT_FOUND);
  }

  const pinHash = pin && pin.length > 0 ? await hash(pin, 12) : undefined;
  const result = await updateStaff({
    staffId: input.staffId,
    name,
    branchId: branch.id,
    businessId: branch.businessId,
    active: input.active,
    canCloseCash: input.canCloseCash,
    commissionRate: input.commissionRate,
    pinHash,
  });

  if (result.count === 0) {
    throw new StaffError(StaffErrorCode.STAFF_NOT_FOUND);
  }
}

function isValidPin(pin: string) {
  return /^\d{4,8}$/.test(pin);
}
