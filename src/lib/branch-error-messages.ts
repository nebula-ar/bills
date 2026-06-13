import { BranchErrorCode } from "@/modules/branches/branch.errors";

const branchErrorMessages: Record<BranchErrorCode, string> = {
  [BranchErrorCode.BUSINESS_NOT_FOUND]: "No encontramos un negocio activo para crear la sucursal.",
  [BranchErrorCode.BRANCH_NOT_FOUND]: "No encontramos esa sucursal para administrar.",
  [BranchErrorCode.NAME_REQUIRED]: "Completá el nombre de la sucursal.",
};

export function getBranchErrorMessage(code: BranchErrorCode) {
  return branchErrorMessages[code];
}
