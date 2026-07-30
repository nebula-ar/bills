"use server";

import { AppModule, PaymentMethod } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { logError } from "@/lib/logger";
import { parsePaymentMethodValue } from "@/lib/payment-labels";
import { payCommission } from "@/modules/staff/commissions.use-case";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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

export async function payCommissionAction(formData: FormData) {
  const { session } = await requireModule(AppModule.STAFF_COMMISSIONS);

  const month = text(formData, "month");
  const amount = money(text(formData, "amount"));
  const from = date(text(formData, "from"));
  const to = date(text(formData, "to"));

  if (!amount || !from || !to) {
    back(month, "error", "Ingresá un importe válido.");
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
    back(month, "error", "No pudimos registrar el pago. Intentá de nuevo.");
  }

  back(month, "success", "Comisión pagada y registrada como gasto.");
}

function back(month: string, status: "success" | "error", message: string): never {
  // La acción acabó de mutar datos y el redirect vuelve a la MISMA ruta: sin
  // invalidarla, el router del cliente puede servir el árbol que ya tenía y el
  // usuario ve el valor de antes (visto de verdad: un ajuste de stock a 50 que
  // seguía mostrando 111).
  revalidatePath("/comisiones");

  const params = new URLSearchParams({ status, message });
  if (month) params.set("month", month);
  redirect(`/comisiones?${params.toString()}`);
}
