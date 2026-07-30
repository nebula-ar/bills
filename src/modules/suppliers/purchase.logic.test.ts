import { PurchaseStatus } from "@/generated/prisma/client";
import { describe, expect, it } from "vitest";

import { isDueSoon, isOverdue, pendingAmount, resolvePurchaseStatus, summarizePayables } from "./purchase.logic";

const NOW = new Date("2026-07-27T10:00:00");

function days(count: number) {
  return new Date(NOW.getTime() + count * 24 * 60 * 60 * 1000);
}

describe("resolvePurchaseStatus", () => {
  it("sin pagos, queda pendiente", () => {
    expect(resolvePurchaseStatus(10_000, 0)).toBe(PurchaseStatus.PENDING);
  });

  it("con un pago parcial, queda parcial", () => {
    expect(resolvePurchaseStatus(10_000, 4000)).toBe(PurchaseStatus.PARTIAL);
  });

  it("pagada justo o de más, queda saldada", () => {
    expect(resolvePurchaseStatus(10_000, 10_000)).toBe(PurchaseStatus.PAID);
    expect(resolvePurchaseStatus(10_000, 10_500)).toBe(PurchaseStatus.PAID);
  });

  it("anulada gana sobre cualquier pago", () => {
    expect(resolvePurchaseStatus(10_000, 10_000, true)).toBe(PurchaseStatus.CANCELLED);
  });
});

describe("pendingAmount", () => {
  it("es lo que falta pagar", () => {
    expect(pendingAmount({ total: 10_000, paid: 4000, status: PurchaseStatus.PARTIAL })).toBe(6000);
  });

  it("nunca es negativo", () => {
    expect(pendingAmount({ total: 10_000, paid: 12_000, status: PurchaseStatus.PAID })).toBe(0);
  });

  it("una factura anulada no se debe", () => {
    expect(pendingAmount({ total: 10_000, paid: 0, status: PurchaseStatus.CANCELLED })).toBe(0);
  });
});

describe("isOverdue", () => {
  it("vencida si pasó la fecha y queda saldo", () => {
    const purchase = { id: "1", total: 10_000, paid: 0, status: PurchaseStatus.PENDING, dueAt: days(-1) };
    expect(isOverdue(purchase, NOW)).toBe(true);
  });

  it("no vencida si ya se pagó", () => {
    const purchase = { id: "1", total: 10_000, paid: 10_000, status: PurchaseStatus.PAID, dueAt: days(-5) };
    expect(isOverdue(purchase, NOW)).toBe(false);
  });

  it("no vencida sin fecha de vencimiento", () => {
    const purchase = { id: "1", total: 10_000, paid: 0, status: PurchaseStatus.PENDING, dueAt: null };
    expect(isOverdue(purchase, NOW)).toBe(false);
  });
});

describe("isDueSoon", () => {
  it("avisa lo que vence dentro de la semana", () => {
    const purchase = { id: "1", total: 10_000, paid: 0, status: PurchaseStatus.PENDING, dueAt: days(3) };
    expect(isDueSoon(purchase, NOW)).toBe(true);
  });

  it("no avisa lo que vence más adelante", () => {
    const purchase = { id: "1", total: 10_000, paid: 0, status: PurchaseStatus.PENDING, dueAt: days(20) };
    expect(isDueSoon(purchase, NOW)).toBe(false);
  });

  it("lo ya vencido no cuenta como 'por vencer'", () => {
    const purchase = { id: "1", total: 10_000, paid: 0, status: PurchaseStatus.PENDING, dueAt: days(-2) };
    expect(isDueSoon(purchase, NOW)).toBe(false);
  });
});

describe("summarizePayables", () => {
  it("separa deuda total, vencida y por vencer", () => {
    const summary = summarizePayables(
      [
        { id: "vencida", total: 10_000, paid: 0, status: PurchaseStatus.PENDING, dueAt: days(-3) },
        { id: "porVencer", total: 20_000, paid: 5000, status: PurchaseStatus.PARTIAL, dueAt: days(2) },
        { id: "lejana", total: 30_000, paid: 0, status: PurchaseStatus.PENDING, dueAt: days(40) },
        { id: "saldada", total: 8000, paid: 8000, status: PurchaseStatus.PAID, dueAt: days(-1) },
        { id: "anulada", total: 5000, paid: 0, status: PurchaseStatus.CANCELLED, dueAt: days(-1) },
      ],
      NOW,
    );

    expect(summary.pending).toBe(10_000 + 15_000 + 30_000);
    expect(summary.overdue).toBe(10_000);
    expect(summary.dueSoon).toBe(15_000);
    expect(summary.overdueCount).toBe(1);
    expect(summary.dueSoonCount).toBe(1);
    expect(summary.openCount).toBe(3);
  });

  it("sin facturas abiertas, da todo en cero", () => {
    const summary = summarizePayables([], NOW);

    expect(summary).toEqual({
      pending: 0,
      overdue: 0,
      dueSoon: 0,
      overdueCount: 0,
      dueSoonCount: 0,
      openCount: 0,
    });
  });
});
