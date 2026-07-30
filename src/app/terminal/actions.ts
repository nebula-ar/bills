"use server";

import { PaymentMethod } from "@/generated/prisma/client";
import { setStaffFlash } from "@/lib/terminal-flash";
import { clearStaffSessionCookie, getStaffSession, setStaffSessionCookie } from "@/lib/terminal-session";
import { getStaffErrorMessage } from "@/lib/staff-error-messages";
import { logError } from "@/lib/logger";
import { parseAmountInput } from "@/lib/money";
import { getSaleErrorMessage } from "@/lib/sale-error-messages";
import { parsePaymentMethod, parseRequiredString } from "@/lib/sale-form-parser";
import { StaffError } from "@/modules/staff/staff.errors";
import { staffCanCloseCash } from "@/modules/cash/cash.logic";
import { createBusinessCashClose } from "@/modules/cash/cash.use-cases";
import { validateStaffPin } from "@/modules/staff/validate-staff-pin.use-case";
import { createSimpleSale } from "@/modules/sales/create-simple-sale.use-case";
import { getSaleEntryOptions } from "@/modules/sales/get-sale-entry-options.use-case";
import { SaleError } from "@/modules/sales/sale.errors";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type RedirectContext = { branchId?: string | null; staffId?: string | null; terminalId?: string | null };

// El empleado se identifica con PIN una vez y abre un "turno" (sesión firmada de 8 hs).
export async function unlockStaffTerminal(formData: FormData) {
  const branchId = parseRequiredString(formData, "branchId");
  const staffId = parseRequiredString(formData, "staffId");
  const pin = parseRequiredString(formData, "pin");
  const terminalId = parseRequiredString(formData, "terminal");
  const terminalLocked = formData.get("terminalLocked") === "1";
  const ctx: RedirectContext = { branchId, staffId: terminalLocked ? staffId : null, terminalId };

  if (!branchId || !staffId || !pin) {
    await redirectWithMessage("error", "Elegí tu perfil y poné tu PIN.", ctx);
    return;
  }

  try {
    await validateStaffPin({ branchId, staffId, pin });
    await setStaffSessionCookie({ branchId, staffId, terminalId });
  } catch (error) {
    if (error instanceof StaffError) {
      await redirectWithMessage("error", getStaffErrorMessage(error.code), ctx);
    }

    await logError("staff.unlock", error, { userId: staffId, context: { branchId, terminalId } });
    await redirectWithMessage("error", "No pudimos validar el PIN. Intentá de nuevo.", ctx);
  }

  await redirectWithMessage("success", "Turno iniciado. Ya podés cargar ventas.", ctx);
}

export async function lockStaffTerminal(formData: FormData) {
  const branchId = parseRequiredString(formData, "branchId");
  const terminalStaffId = parseRequiredString(formData, "terminalStaff");
  const terminalId = parseRequiredString(formData, "terminal");

  await clearStaffSessionCookie();
  await redirectWithMessage("success", "Cerraste el turno.", { branchId, staffId: terminalStaffId, terminalId });
}

export type StaffSaleItem = { productId: string; quantity: number };
export type StaffSaleResult = { ok: true } | { ok: false; error: string };

// Venta rápida desde la terminal (kiosco): recibe items + método de pago del
// cliente, usa el empleado de la sesión firmada y devuelve un resultado sin recargar.
export async function submitStaffSale(input: {
  items: StaffSaleItem[];
  paymentMethod: string;
}): Promise<StaffSaleResult> {
  const session = await getStaffSession();
  if (!session) {
    return { ok: false, error: "Se cerró tu turno. Ingresá tu PIN de nuevo." };
  }

  const paymentMethod = parsePaymentMethod(input.paymentMethod);
  if (!paymentMethod) {
    return { ok: false, error: "Elegí un método de pago." };
  }

  const items = (input.items ?? []).filter(
    (item) => typeof item.productId === "string" && Number.isInteger(item.quantity) && item.quantity > 0,
  );
  if (items.length === 0) {
    return { ok: false, error: "Agregá al menos un servicio." };
  }

  try {
    await createSimpleSale({
      branchId: session.branchId,
      staffId: session.staffId,
      terminalId: session.terminalId ?? null,
      items,
      paymentMethod,
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof SaleError) {
      return { ok: false, error: getSaleErrorMessage(error.code) };
    }
    await logError("staff.sale", error, { userId: session.staffId, context: { branchId: session.branchId, terminalId: session.terminalId ?? null } });
    return { ok: false, error: "No pudimos registrar la venta. Intentá de nuevo." };
  }
}

// Cierre de caja desde la terminal: solo empleados "encargados" (canCloseCash) y
// únicamente sobre la caja de SU sucursal (la del turno).
export async function submitStaffCashClose(formData: FormData) {
  const session = await getStaffSession();
  if (!session) {
    await setStaffFlash({ status: "error", message: "Se cerró tu turno. Ingresá tu PIN de nuevo." });
    redirect("/terminal");
  }

  const branch = await getSaleEntryOptions(session.branchId);
  const staff = branch?.users.find((user) => user.id === session.staffId) ?? null;
  if (!branch || !staffCanCloseCash(staff)) {
    await setStaffFlash({ status: "error", message: "No tenés permiso para cerrar la caja." });
    redirect("/terminal");
  }

  const counted: Partial<Record<PaymentMethod, number>> = {};
  for (const method of Object.values(PaymentMethod)) {
    const raw = formData.get(`counted_${method}`);
    if (typeof raw === "string" && raw.trim() !== "") {
      const value = parseAmountInput(raw.trim());
      if (value !== null) counted[method] = value;
    }
  }

  const noteRaw = formData.get("note");
  const note = typeof noteRaw === "string" && noteRaw.trim() !== "" ? noteRaw.trim() : null;

  try {
    await createBusinessCashClose({ businessId: branch.businessId, branchId: session.branchId, note, counted });
  } catch (error) {
    await logError("staff.cash-close", error, { businessId: branch.businessId, userId: session.staffId, context: { branchId: session.branchId } });
    await setStaffFlash({ status: "error", message: "No pudimos cerrar la caja. Intentá de nuevo." });
    redirect("/terminal");
  }

  await setStaffFlash({ status: "success", message: "Caja cerrada. ¡Buen trabajo!" });
  redirect("/terminal");
}

async function redirectWithMessage(status: "error" | "success", message: string, ctx: RedirectContext): Promise<never> {
  // El mensaje viaja por cookie efímera, no por la URL.
  await setStaffFlash({ status, message });

  // El redirect vuelve a la MISMA ruta de la que salimos. Sin invalidarla, el
  // router del cliente puede servir el árbol que ya tenía y la pantalla queda
  // como estaba: visto de verdad, un PIN correcto que dejaba el formulario de
  // PIN en pantalla porque el turno recién abierto no se re-renderizaba.
  revalidatePath("/terminal");
  revalidatePath("/terminal/mis-ventas");

  const params = new URLSearchParams();
  if (ctx.terminalId) {
    params.set("terminal", ctx.terminalId);
  } else {
    if (ctx.branchId) {
      params.set("branch", ctx.branchId);
    }
    if (ctx.staffId) {
      params.set("staff", ctx.staffId);
    }
  }

  const query = params.toString();
  redirect(query ? `/terminal?${query}` : "/terminal");
}
