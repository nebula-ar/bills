import type { PaymentMethod } from "@/generated/prisma/client";
import { describe, expect, it } from "vitest";

import { accountHasActivity, buildCashCloseLines, computeAccountBalances, validateTransfer, type AccountBalance } from "./cash.logic";

const CASH = "CASH" as PaymentMethod;
const MP = "MERCADO_PAGO" as PaymentMethod;
const TRANSFER = "TRANSFER" as PaymentMethod;
const ORDER: PaymentMethod[] = [CASH, MP, TRANSFER];

function balancesByMethod(list: AccountBalance[]) {
  return new Map(list.map((account) => [account.method, account]));
}

describe("computeAccountBalances", () => {
  it("saldo = inicial + ventas − gastos + transf. entran − transf. salen", () => {
    const result = computeAccountBalances({
      order: ORDER,
      openings: [{ paymentMethod: CASH, amount: 100_000 }],
      income: new Map([[CASH, 50_000]]),
      expense: new Map([[CASH, 20_000]]),
      transfers: [
        { fromMethod: MP, toMethod: CASH, amount: 10_000 }, // entra 10k a efectivo
        { fromMethod: CASH, toMethod: TRANSFER, amount: 5_000 }, // sale 5k de efectivo
      ],
    });

    const cash = balancesByMethod(result).get(CASH)!;
    expect(cash.opening).toBe(100_000);
    expect(cash.income).toBe(50_000);
    expect(cash.expense).toBe(20_000);
    expect(cash.transferIn).toBe(10_000);
    expect(cash.transferOut).toBe(5_000);
    // 100000 + 50000 - 20000 + 10000 - 5000
    expect(cash.balance).toBe(135_000);
  });

  it("refleja la contracara de las transferencias en las otras cuentas", () => {
    const map = balancesByMethod(
      computeAccountBalances({
        order: ORDER,
        openings: [],
        income: new Map(),
        expense: new Map(),
        transfers: [{ fromMethod: MP, toMethod: CASH, amount: 10_000 }],
      }),
    );

    expect(map.get(MP)!.transferOut).toBe(10_000);
    expect(map.get(MP)!.balance).toBe(-10_000);
    expect(map.get(CASH)!.transferIn).toBe(10_000);
    expect(map.get(CASH)!.balance).toBe(10_000);
  });

  it("puede dar saldo negativo (más gastos que ingresos)", () => {
    const map = balancesByMethod(
      computeAccountBalances({
        order: ORDER,
        openings: [],
        income: new Map([[CASH, 1_000]]),
        expense: new Map([[CASH, 3_500]]),
        transfers: [],
      }),
    );
    expect(map.get(CASH)!.balance).toBe(-2_500);
  });

  it("devuelve todas las cuentas del orden, en ese orden, con ceros cuando no hay datos", () => {
    const result = computeAccountBalances({
      order: ORDER,
      openings: [],
      income: new Map(),
      expense: new Map(),
      transfers: [],
    });
    expect(result.map((a) => a.method)).toEqual(ORDER);
    expect(result.every((a) => a.balance === 0)).toBe(true);
  });

  it("acumula varios saldos iniciales y transferencias de la misma cuenta", () => {
    const map = balancesByMethod(
      computeAccountBalances({
        order: ORDER,
        openings: [
          { paymentMethod: CASH, amount: 1_000 },
          { paymentMethod: CASH, amount: 500 },
        ],
        income: new Map(),
        expense: new Map(),
        transfers: [
          { fromMethod: CASH, toMethod: MP, amount: 200 },
          { fromMethod: CASH, toMethod: MP, amount: 300 },
        ],
      }),
    );
    expect(map.get(CASH)!.opening).toBe(1_500);
    expect(map.get(CASH)!.transferOut).toBe(500);
    expect(map.get(CASH)!.balance).toBe(1_000);
  });

  it("el total del negocio se conserva ante transferencias internas (suma cero)", () => {
    const result = computeAccountBalances({
      order: ORDER,
      openings: [{ paymentMethod: CASH, amount: 100_000 }],
      income: new Map(),
      expense: new Map(),
      transfers: [{ fromMethod: CASH, toMethod: MP, amount: 40_000 }],
    });
    const total = result.reduce((sum, a) => sum + a.balance, 0);
    expect(total).toBe(100_000);
  });
});

describe("accountHasActivity", () => {
  const zero: AccountBalance = { method: CASH, opening: 0, income: 0, expense: 0, transferIn: 0, transferOut: 0, balance: 0 };

  it("false cuando no hay ningún movimiento", () => {
    expect(accountHasActivity(zero)).toBe(false);
  });

  it("true si hay saldo inicial aunque el balance sea 0", () => {
    expect(accountHasActivity({ ...zero, opening: 10, transferOut: 10 })).toBe(true);
  });

  it("true con solo ingresos", () => {
    expect(accountHasActivity({ ...zero, income: 1, balance: 1 })).toBe(true);
  });
});

describe("validateTransfer", () => {
  it("acepta monto positivo entre cuentas distintas", () => {
    expect(validateTransfer({ fromMethod: MP, toMethod: CASH, amount: 1_000 })).toEqual({ ok: true });
  });

  it("rechaza la misma cuenta", () => {
    expect(validateTransfer({ fromMethod: CASH, toMethod: CASH, amount: 1_000 })).toEqual({ ok: false, error: "SAME_ACCOUNT" });
  });

  it("rechaza monto 0, negativo o no entero", () => {
    expect(validateTransfer({ fromMethod: MP, toMethod: CASH, amount: 0 })).toEqual({ ok: false, error: "INVALID_AMOUNT" });
    expect(validateTransfer({ fromMethod: MP, toMethod: CASH, amount: -5 })).toEqual({ ok: false, error: "INVALID_AMOUNT" });
    expect(validateTransfer({ fromMethod: MP, toMethod: CASH, amount: 1.5 })).toEqual({ ok: false, error: "INVALID_AMOUNT" });
  });
});

describe("buildCashCloseLines", () => {
  const base: AccountBalance = { method: CASH, opening: 0, income: 0, expense: 0, transferIn: 0, transferOut: 0, balance: 0 };

  it("guarda systemAmount = saldo y countedAmount = lo contado", () => {
    const lines = buildCashCloseLines([{ ...base, method: CASH, balance: 10_000 }], { [CASH]: 9_500 });
    expect(lines).toEqual([{ paymentMethod: CASH, systemAmount: 10_000, countedAmount: 9_500 }]);
  });

  it("si no se contó, countedAmount cae al saldo del sistema (sin diferencia)", () => {
    const lines = buildCashCloseLines([{ ...base, method: CASH, balance: 10_000 }], {});
    expect(lines[0]).toEqual({ paymentMethod: CASH, systemAmount: 10_000, countedAmount: 10_000 });
  });

  it("excluye cuentas en cero sin conteo", () => {
    const lines = buildCashCloseLines(
      [
        { ...base, method: CASH, balance: 0 },
        { ...base, method: MP, balance: 5_000 },
      ],
      {},
    );
    expect(lines.map((l) => l.paymentMethod)).toEqual([MP]);
  });

  it("incluye una cuenta en cero si el usuario contó algo (sobrante)", () => {
    const lines = buildCashCloseLines([{ ...base, method: CASH, balance: 0 }], { [CASH]: 2_000 });
    expect(lines).toEqual([{ paymentMethod: CASH, systemAmount: 0, countedAmount: 2_000 }]);
  });
});
