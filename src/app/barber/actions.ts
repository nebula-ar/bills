"use server";

import { PaymentMethod } from "@/generated/prisma/client";
import { setBarberFlash } from "@/lib/barber-flash";
import { clearBarberSessionCookie, getBarberSession, setBarberSessionCookie } from "@/lib/barber-session";
import { getBarberErrorMessage } from "@/lib/barber-error-messages";
import { parseAmountInput } from "@/lib/money";
import { getSaleErrorMessage } from "@/lib/sale-error-messages";
import { parsePaymentMethod, parseRequiredString } from "@/lib/sale-form-parser";
import { BarberError } from "@/modules/barbers/barber.errors";
import { barberCanCloseCash } from "@/modules/cash/cash.logic";
import { createBusinessCashClose } from "@/modules/cash/cash.use-cases";
import { validateBarberPin } from "@/modules/barbers/validate-barber-pin.use-case";
import { createSimpleSale } from "@/modules/sales/create-simple-sale.use-case";
import { getSaleEntryOptions } from "@/modules/sales/get-sale-entry-options.use-case";
import { SaleError } from "@/modules/sales/sale.errors";
import { redirect } from "next/navigation";

type RedirectContext = { branchId?: string | null; barberId?: string | null; terminalId?: string | null };

// El barbero se identifica con PIN una vez y abre un "turno" (sesión firmada de 8 hs).
export async function unlockBarberTerminal(formData: FormData) {
  const branchId = parseRequiredString(formData, "branchId");
  const barberId = parseRequiredString(formData, "barberId");
  const pin = parseRequiredString(formData, "pin");
  const terminalId = parseRequiredString(formData, "terminal");
  const terminalLocked = formData.get("terminalLocked") === "1";
  const ctx: RedirectContext = { branchId, barberId: terminalLocked ? barberId : null, terminalId };

  if (!branchId || !barberId || !pin) {
    await redirectWithMessage("error", "Elegí tu perfil y poné tu PIN.", ctx);
    return;
  }

  try {
    await validateBarberPin({ branchId, barberId, pin });
    await setBarberSessionCookie({ branchId, barberId, terminalId });
  } catch (error) {
    if (error instanceof BarberError) {
      await redirectWithMessage("error", getBarberErrorMessage(error.code), ctx);
    }

    console.error(error);
    await redirectWithMessage("error", "No pudimos validar el PIN. Intentá de nuevo.", ctx);
  }

  await redirectWithMessage("success", "Turno iniciado. Ya podés cargar ventas.", ctx);
}

export async function lockBarberTerminal(formData: FormData) {
  const branchId = parseRequiredString(formData, "branchId");
  const terminalBarberId = parseRequiredString(formData, "terminalBarber");
  const terminalId = parseRequiredString(formData, "terminal");

  await clearBarberSessionCookie();
  await redirectWithMessage("success", "Cerraste el turno.", { branchId, barberId: terminalBarberId, terminalId });
}

export type BarberSaleItem = { serviceId: string; quantity: number };
export type BarberSaleResult = { ok: true } | { ok: false; error: string };

// Venta rápida desde la terminal (kiosco): recibe items + método de pago del
// cliente, usa el barbero de la sesión firmada y devuelve un resultado sin recargar.
export async function submitBarberSale(input: {
  items: BarberSaleItem[];
  paymentMethod: string;
}): Promise<BarberSaleResult> {
  const session = await getBarberSession();
  if (!session) {
    return { ok: false, error: "Se cerró tu turno. Ingresá tu PIN de nuevo." };
  }

  const paymentMethod = parsePaymentMethod(input.paymentMethod);
  if (!paymentMethod) {
    return { ok: false, error: "Elegí un método de pago." };
  }

  const items = (input.items ?? []).filter(
    (item) => typeof item.serviceId === "string" && Number.isInteger(item.quantity) && item.quantity > 0,
  );
  if (items.length === 0) {
    return { ok: false, error: "Agregá al menos un servicio." };
  }

  try {
    await createSimpleSale({
      branchId: session.branchId,
      barberId: session.barberId,
      terminalId: session.terminalId ?? null,
      items,
      paymentMethod,
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof SaleError) {
      return { ok: false, error: getSaleErrorMessage(error.code) };
    }
    console.error(error);
    return { ok: false, error: "No pudimos registrar la venta. Intentá de nuevo." };
  }
}

// Cierre de caja desde la terminal: solo barberos "encargados" (canCloseCash) y
// únicamente sobre la caja de SU sucursal (la del turno).
export async function submitBarberCashClose(formData: FormData) {
  const session = await getBarberSession();
  if (!session) {
    await setBarberFlash({ status: "error", message: "Se cerró tu turno. Ingresá tu PIN de nuevo." });
    redirect("/barber");
  }

  const branch = await getSaleEntryOptions(session.branchId);
  const barber = branch?.users.find((user) => user.id === session.barberId) ?? null;
  if (!branch || !barberCanCloseCash(barber)) {
    await setBarberFlash({ status: "error", message: "No tenés permiso para cerrar la caja." });
    redirect("/barber");
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
    console.error(error);
    await setBarberFlash({ status: "error", message: "No pudimos cerrar la caja. Intentá de nuevo." });
    redirect("/barber");
  }

  await setBarberFlash({ status: "success", message: "Caja cerrada. ¡Buen trabajo!" });
  redirect("/barber");
}

async function redirectWithMessage(status: "error" | "success", message: string, ctx: RedirectContext): Promise<never> {
  // El mensaje viaja por cookie efímera, no por la URL.
  await setBarberFlash({ status, message });

  const params = new URLSearchParams();
  if (ctx.terminalId) {
    params.set("terminal", ctx.terminalId);
  } else {
    if (ctx.branchId) {
      params.set("branch", ctx.branchId);
    }
    if (ctx.barberId) {
      params.set("barber", ctx.barberId);
    }
  }

  const query = params.toString();
  redirect(query ? `/barber?${query}` : "/barber");
}
