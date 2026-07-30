import { PaymentMethod } from "@/generated/prisma/client";
import { logEvent } from "@/lib/logger";
import { PAYMENT_METHOD_ORDER } from "@/lib/payment-labels";
import { findCustomerPaymentsByMethod } from "@/modules/customers/customer.repository";
import { findReturnsByMethod } from "@/modules/sales/return-sale.use-case";
import { findPurchasePaymentsByMethod } from "@/modules/suppliers/supplier.repository";

import { buildCashCloseLines, computeAccountBalances, validateTransfer, type AccountBalance } from "./cash.logic";
import {
  createCashClose,
  createTransfer,
  findCashCloses,
  findExpensesByMethod,
  findOpeningBalances,
  findSalesIncomeByMethod,
  findTransfers,
  softDeleteTransfer,
  upsertOpeningBalance,
  type CashScope,
} from "./cash.repository";

export type { AccountBalance };

// Motor de saldos: por cuenta, saldo inicial + ingresos − gastos + transferencias.
// Sin rango de fechas => saldo real actual ("cuánto hay en cada cuenta").
//
// Hay cinco flujos de plata, no dos. Entra: ventas y lo que los clientes pagan
// de su cuenta corriente (el fiado recién se cobra ahí). Sale: gastos, pagos a
// proveedores y devoluciones a clientes.
export async function getAccountBalances(scope: CashScope): Promise<AccountBalance[]> {
  const [salesIncome, customerPayments, expenses, supplierPayments, returns, transfers, openings] = await Promise.all([
    findSalesIncomeByMethod(scope),
    findCustomerPaymentsByMethod(scope),
    findExpensesByMethod(scope),
    findPurchasePaymentsByMethod(scope),
    findReturnsByMethod(scope),
    findTransfers(scope),
    findOpeningBalances(scope.businessId, scope.branchId ?? null),
  ]);

  return computeAccountBalances({
    order: PAYMENT_METHOD_ORDER,
    openings,
    income: mergeByMethod(salesIncome, customerPayments),
    expense: mergeByMethod(expenses, supplierPayments, returns),
    transfers,
  });
}

// Suma dos agregados por método en uno solo.
function mergeByMethod(...maps: Map<PaymentMethod, number>[]): Map<PaymentMethod, number> {
  const merged = new Map<PaymentMethod, number>();

  for (const map of maps) {
    for (const [method, amount] of map) {
      merged.set(method, (merged.get(method) ?? 0) + amount);
    }
  }

  return merged;
}

export async function setOpeningBalance(input: {
  businessId: string;
  branchId?: string | null;
  paymentMethod: PaymentMethod;
  amount: number;
}) {
  if (!Number.isInteger(input.amount) || input.amount < 0) {
    throw new Error("INVALID_AMOUNT");
  }
  return upsertOpeningBalance({
    businessId: input.businessId,
    branchId: input.branchId ?? null,
    paymentMethod: input.paymentMethod,
    amount: input.amount,
  });
}

export function listTransfers(scope: CashScope) {
  return findTransfers(scope);
}

export async function createBusinessTransfer(input: {
  businessId: string;
  branchId?: string | null;
  fromMethod: PaymentMethod;
  toMethod: PaymentMethod;
  amount: number;
  note?: string | null;
  movedAt: Date;
}) {
  const validation = validateTransfer({ fromMethod: input.fromMethod, toMethod: input.toMethod, amount: input.amount });
  if (!validation.ok) {
    throw new Error(validation.error);
  }
  const transfer = await createTransfer({
    businessId: input.businessId,
    branchId: input.branchId ?? null,
    fromMethod: input.fromMethod,
    toMethod: input.toMethod,
    amount: input.amount,
    note: input.note ?? null,
    movedAt: input.movedAt,
  });
  await logEvent("cash.transfer", `Transferencia de $${input.amount} (${input.fromMethod} → ${input.toMethod})`, {
    businessId: input.businessId,
    context: { transferId: transfer.id, branchId: input.branchId ?? null, from: input.fromMethod, to: input.toMethod, amount: input.amount },
  });
  return transfer;
}

export async function deleteBusinessTransfer(input: { businessId: string; transferId: string }) {
  const result = await softDeleteTransfer(input.businessId, input.transferId);
  if (!result) {
    throw new Error("TRANSFER_NOT_FOUND");
  }
  return result;
}

export function listCashCloses(businessId: string) {
  return findCashCloses(businessId);
}

// Cierre de caja: guarda el saldo teórico (sistema) por cuenta y lo contado.
export async function createBusinessCashClose(input: {
  businessId: string;
  branchId?: string | null;
  note?: string | null;
  counted: Partial<Record<PaymentMethod, number>>;
}) {
  const balances = await getAccountBalances({ businessId: input.businessId, branchId: input.branchId ?? null });
  const lines = buildCashCloseLines(balances, input.counted);

  const close = await createCashClose({
    businessId: input.businessId,
    branchId: input.branchId ?? null,
    note: input.note ?? null,
    lines,
  });
  const totalSystem = lines.reduce((sum, line) => sum + line.systemAmount, 0);
  const totalCounted = lines.reduce((sum, line) => sum + line.countedAmount, 0);
  await logEvent("cash.close", `Cierre de caja (contado $${totalCounted}, diferencia $${totalCounted - totalSystem})`, {
    businessId: input.businessId,
    context: { closeId: close.id, branchId: input.branchId ?? null, totalSystem, totalCounted, diff: totalCounted - totalSystem },
  });
  return close;
}
