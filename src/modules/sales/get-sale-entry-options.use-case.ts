import { findSaleEntryBranches, findSaleEntryOptionsBranch } from "./sale.repository";

export async function getSaleEntryOptions(branchId?: string) {
  return findSaleEntryOptionsBranch(branchId);
}

export async function getSaleEntryBranches() {
  return findSaleEntryBranches();
}
