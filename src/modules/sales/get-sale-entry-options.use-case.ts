import { findSaleEntryOptionsBranch } from "./sale.repository";

export async function getSaleEntryOptions() {
  return findSaleEntryOptionsBranch();
}
