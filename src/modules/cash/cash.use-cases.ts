import { PaymentMethod } from "@/generated/prisma/client";
import { PAYMENT_METHOD_ORDER } from "@/lib/payment-labels";

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
export async function getAccountBalances(scope: CashScope): Promise<AccountBalance[]> {
  const [income, expense, transfers, openings] = await Promise.all([
    findSalesIncomeByMethod(scope),
    findExpensesByMethod(scope),
    findTransfers(scope),
    findOpeningBalances(scope.businessId, scope.branchId ?? null),
  ]);

  return computeAccountBalances({ order: PAYMENT_METHOD_ORDER, openings, income, expense, transfers });
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
  return createTransfer({
    businessId: input.businessId,
    branchId: input.branchId ?? null,
    fromMethod: input.fromMethod,
    toMethod: input.toMethod,
    amount: input.amount,
    note: input.note ?? null,
    movedAt: input.movedAt,
  });
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

  return createCashClose({
    businessId: input.businessId,
    branchId: input.branchId ?? null,
    note: input.note ?? null,
    lines,
  });
}
