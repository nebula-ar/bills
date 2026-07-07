import { BranchError, BranchErrorCode } from "./branch.errors";
import { createBranch } from "./branch.repository";

export type CreateBranchInput = {
  businessId: string;
  name: string;
  address?: string;
};

export async function createBranchForManagement(input: CreateBranchInput) {
  const name = input.name.trim();
  const address = normalizeOptionalString(input.address);

  if (!name) {
    throw new BranchError(BranchErrorCode.NAME_REQUIRED);
  }

  return createBranch({
    businessId: input.businessId,
    name,
    address,
  });
}

function normalizeOptionalString(value: string | undefined) {
  const trimmedValue = value?.trim();
  return trimmedValue && trimmedValue.length > 0 ? trimmedValue : undefined;
}
