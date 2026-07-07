import { findBranchesForManagement } from "./branch.repository";

export async function getBranchesForManagement(businessId: string) {
  return findBranchesForManagement(businessId);
}
