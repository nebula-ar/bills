import type { PaymentMethod } from "@/generated/prisma/client";

// Lógica pura del módulo de Caja: sin Prisma ni efectos, para poder testearla
// aislada. `PaymentMethod` se importa como tipo (se borra en runtime), así que
// este archivo no arrastra el cliente generado a los tests.

export type AccountBalance = {
  method: PaymentMethod;
  opening: number;
  income: number;
  expense: number;
  transferIn: number;
  transferOut: number;
  balance: number;
};

export type BalanceInputs = {
  order: PaymentMethod[];
  openings: { paymentMethod: PaymentMethod; amount: number }[];
  income: Map<PaymentMethod, number>;
  expense: Map<PaymentMethod, number>;
  transfers: { fromMethod: PaymentMethod; toMethod: PaymentMethod; amount: number }[];
};

// Saldo por cuenta = saldo inicial + ingresos − gastos + transferencias que entran − que salen.
export function computeAccountBalances(input: BalanceInputs): AccountBalance[] {
  const openingMap = new Map<PaymentMethod, number>();
  for (const opening of input.openings) {
    openingMap.set(opening.paymentMethod, (openingMap.get(opening.paymentMethod) ?? 0) + opening.amount);
  }

  const inMap = new Map<PaymentMethod, number>();
  const outMap = new Map<PaymentMethod, number>();
  for (const transfer of input.transfers) {
    outMap.set(transfer.fromMethod, (outMap.get(transfer.fromMethod) ?? 0) + transfer.amount);
    inMap.set(transfer.toMethod, (inMap.get(transfer.toMethod) ?? 0) + transfer.amount);
  }

  return input.order.map((method) => {
    const opening = openingMap.get(method) ?? 0;
    const income = input.income.get(method) ?? 0;
    const expense = input.expense.get(method) ?? 0;
    const transferIn = inMap.get(method) ?? 0;
    const transferOut = outMap.get(method) ?? 0;
    return {
      method,
      opening,
      income,
      expense,
      transferIn,
      transferOut,
      balance: opening + income - expense + transferIn - transferOut,
    };
  });
}

export function accountHasActivity(account: AccountBalance): boolean {
  return (
    account.opening !== 0 ||
    account.income !== 0 ||
    account.expense !== 0 ||
    account.transferIn !== 0 ||
    account.transferOut !== 0
  );
}

// Solo un empleado "encargado" (canCloseCash) puede cerrar caja desde la terminal.
export function staffCanCloseCash(staff: { canCloseCash: boolean } | null | undefined): boolean {
  return staff?.canCloseCash === true;
}

export type TransferValidation = { ok: true } | { ok: false; error: "INVALID_AMOUNT" | "SAME_ACCOUNT" };

export function validateTransfer(input: { fromMethod: PaymentMethod; toMethod: PaymentMethod; amount: number }): TransferValidation {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    return { ok: false, error: "INVALID_AMOUNT" };
  }
  if (input.fromMethod === input.toMethod) {
    return { ok: false, error: "SAME_ACCOUNT" };
  }
  return { ok: true };
}

// Líneas del cierre: se guardan las cuentas con saldo o con conteo. El saldo del
// sistema es el calculado; lo contado es lo que ingresó el usuario (o el sistema
// si no contó nada).
export function buildCashCloseLines(
  balances: AccountBalance[],
  counted: Partial<Record<PaymentMethod, number>>,
): { paymentMethod: PaymentMethod; systemAmount: number; countedAmount: number }[] {
  return balances
    .filter((account) => account.balance !== 0 || (counted[account.method] ?? 0) !== 0)
    .map((account) => ({
      paymentMethod: account.method,
      systemAmount: account.balance,
      countedAmount: Math.round(counted[account.method] ?? account.balance),
    }));
}
