import { ExpenseCategory, PaymentMethod, SaleStatus, UserRole } from "@/generated/prisma/client";
import { logEvent } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

import { summarizeCommissions, type CommissionSummary } from "./commissions.logic";

export type CommissionPeriod = { from: Date; to: Date };

// Liquidación del período: qué vendió cada empleado y cuánto le toca.
// Solo cuenta ventas COMPLETADAS: una venta anulada no genera comisión, que es
// justamente lo que evita que se "vendan" cosas para inflar la liquidación.
export async function getCommissionSummary(input: {
  businessId: string;
  branchId?: string | null;
  period: CommissionPeriod;
}): Promise<CommissionSummary> {
  const [staff, sales] = await Promise.all([
    prisma.user.findMany({
      where: {
        businessId: input.businessId,
        deleted: false,
        active: true,
        role: UserRole.STAFF,
        ...(input.branchId ? { branchId: input.branchId } : {}),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, commissionRate: true },
    }),
    prisma.sale.findMany({
      where: {
        deleted: false,
        status: SaleStatus.COMPLETED,
        soldAt: { gte: input.period.from, lte: input.period.to },
        branch: { businessId: input.businessId, deleted: false },
        ...(input.branchId ? { branchId: input.branchId } : {}),
      },
      select: { staffId: true, total: true },
    }),
  ]);

  return summarizeCommissions(staff, sales);
}

// Pagar la comisión deja rastro donde tiene que dejarlo: como un gasto, que sale
// de una cuenta y aparece en la caja. Si no, la plata se va del cajón y el
// sistema sigue diciendo que está.
export async function payCommission(input: {
  businessId: string;
  branchId?: string | null;
  staffId: string;
  amount: number;
  method: PaymentMethod;
  period: CommissionPeriod;
  userId?: string | null;
}) {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error("INVALID_AMOUNT");
  }

  const staff = await prisma.user.findFirst({
    where: { id: input.staffId, businessId: input.businessId, deleted: false },
    select: { id: true, name: true },
  });

  if (!staff) {
    throw new Error("STAFF_NOT_FOUND");
  }

  const period = `${format(input.period.from)} al ${format(input.period.to)}`;

  const expense = await prisma.expense.create({
    data: {
      businessId: input.businessId,
      branchId: input.branchId ?? null,
      category: ExpenseCategory.SALARIES,
      paymentMethod: input.method,
      amount: input.amount,
      note: `Comisión de ${staff.name} (${period})`,
      createdById: input.userId,
    },
  });

  await logEvent("staff.commission.pay", `Comisión pagada a ${staff.name} por $${input.amount}`, {
    businessId: input.businessId,
    userId: input.userId ?? undefined,
    context: { staffId: staff.id, amount: input.amount, method: input.method, expenseId: expense.id, period },
  });

  return expense;
}

function format(date: Date) {
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}
