import { BranchError, BranchErrorCode } from "./branch.errors";
import { updateBranch } from "./branch.repository";

export type UpdateBranchInput = {
  branchId: string;
  name: string;
  address?: string;
  active: boolean;
};

export async function updateBranchForManagement(input: UpdateBranchInput) {
  const name = input.name.trim();
  const address = normalizeOptionalString(input.address);

  if (!name) {
    throw new BranchError(BranchErrorCode.NAME_REQUIRED);
  }

  const result = await updateBranch({
    branchId: input.branchId,
    name,
    address,
    active: input.active,
  });

  if (result.count === 0) {
    throw new BranchError(BranchErrorCode.BRANCH_NOT_FOUND);
  }
}

function normalizeOptionalString(value: string | undefined) {
  const trimmedValue = value?.trim();
  return trimmedValue && trimmedValue.length > 0 ? trimmedValue : undefined;
}
