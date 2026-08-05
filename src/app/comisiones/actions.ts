"use server";

import { AppModule, PaymentMethod } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { logError } from "@/lib/logger";
import { parsePaymentMethodValue } from "@/lib/payment-labels";
import { payCommission } from "@/modules/staff/commissions.use-case";

export type PayCommissionActionResult = { ok: boolean; message: string };

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function money(value: string): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function date(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

export async function payCommissionAction(formData: FormData): Promise<PayCommissionActionResult> {
  const { session } = await requireModule(AppModule.STAFF_COMMISSIONS);

  const amount = money(text(formData, "amount"));
  const from = date(text(formData, "from"));
  const to = date(text(formData, "to"));

  if (!amount || !from || !to) {
    return { ok: false, message: "Ingresá un importe válido." };
  }

  to.setHours(23, 59, 59, 999);

  try {
    await payCommission({
      businessId: session.user.businessId,
      staffId: text(formData, "staffId"),
      amount,
      method: parsePaymentMethodValue(formData.get("method")) ?? PaymentMethod.CASH,
      period: { from, to },
      userId: session.user.id,
    });
  } catch (error) {
    await logError("staff.commission.pay", error, {
      businessId: session.user.businessId,
      userId: session.user.id,
    });
    return { ok: false, message: "No pudimos registrar el pago. Intentá de nuevo." };
  }

  return { ok: true, message: "Comisión pagada y registrada como gasto." };
}
