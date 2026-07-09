import { PaymentMethod } from "@/generated/prisma/client";
import { PAYMENT_METHOD_ORDER } from "@/lib/payment-labels";

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

export type AccountBalance = {
  method: PaymentMethod;
  opening: number;
  income: number;
  expense: number;
  transferIn: number;
  transferOut: number;
  balance: number;
};

// Motor de saldos: por cuenta, saldo inicial + ingresos − gastos + transferencias.
// Sin rango de fechas => saldo real actual ("cuánto hay en cada cuenta").
export async function getAccountBalances(scope: CashScope): Promise<AccountBalance[]> {
  const [income, expense, transfers, openings] = await Promise.all([
    findSalesIncomeByMethod(scope),
    findExpensesByMethod(scope),
    findTransfers(scope),
    findOpeningBalances(scope.businessId, scope.branchId ?? null),
  ]);

  const openingMap = new Map(openings.map((o) => [o.paymentMethod, o.amount]));
  const inMap = new Map<PaymentMethod, number>();
  const outMap = new Map<PaymentMethod, number>();
  for (const transfer of transfers) {
    outMap.set(transfer.fromMethod, (outMap.get(transfer.fromMethod) ?? 0) + transfer.amount);
    inMap.set(transfer.toMethod, (inMap.get(transfer.toMethod) ?? 0) + transfer.amount);
  }

  return PAYMENT_METHOD_ORDER.map((method) => {
    const opening = openingMap.get(method) ?? 0;
    const inc = income.get(method) ?? 0;
    const exp = expense.get(method) ?? 0;
    const transferIn = inMap.get(method) ?? 0;
    const transferOut = outMap.get(method) ?? 0;
    return {
      method,
      opening,
      income: inc,
      expense: exp,
      transferIn,
      transferOut,
      balance: opening + inc - exp + transferIn - transferOut,
    };
  });
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
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error("INVALID_AMOUNT");
  }
  if (input.fromMethod === input.toMethod) {
    throw new Error("SAME_ACCOUNT");
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
  const lines = balances
    .filter((account) => account.balance !== 0 || (input.counted[account.method] ?? 0) !== 0)
    .map((account) => ({
      paymentMethod: account.method,
      systemAmount: account.balance,
      countedAmount: Math.round(input.counted[account.method] ?? account.balance),
    }));

  return createCashClose({
    businessId: input.businessId,
    branchId: input.branchId ?? null,
    note: input.note ?? null,
    lines,
  });
}
