import { findSaleEntryBranches, findSaleEntryOptionsBranch } from "./sale.repository";

export async function getSaleEntryOptions() {
  return findSaleEntryOptionsBranch();
}

export async function getSaleEntryBranches() {
  return findSaleEntryBranches();
}
