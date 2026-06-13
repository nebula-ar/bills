import { findBranchesForManagement } from "./branch.repository";

export async function getBranchesForManagement() {
  return findBranchesForManagement();
}
