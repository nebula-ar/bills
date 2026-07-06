"use server";

import { clearBarberSessionCookie, getBarberSession, setBarberSessionCookie } from "@/lib/barber-session";
import { getBarberErrorMessage } from "@/lib/barber-error-messages";
import { getSaleErrorMessage } from "@/lib/sale-error-messages";
import { parsePaymentMethod, parseRequiredString, parseSaleItemsFromFormData } from "@/lib/sale-form-parser";
import { BarberError } from "@/modules/barbers/barber.errors";
import { validateBarberPin } from "@/modules/barbers/validate-barber-pin.use-case";
import { createSimpleSale } from "@/modules/sales/create-simple-sale.use-case";
import { SaleError } from "@/modules/sales/sale.errors";
import { redirect } from "next/navigation";

const genericErrorMessage = "No pudimos registrar la venta. Intentá de nuevo.";

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
    redirectWithMessage("error", "Elegí tu perfil y poné tu PIN.", ctx);
  }

  try {
    await validateBarberPin({ branchId, barberId, pin });
    await setBarberSessionCookie({ branchId, barberId, terminalId });
  } catch (error) {
    if (error instanceof BarberError) {
      redirectWithMessage("error", getBarberErrorMessage(error.code), ctx);
    }

    console.error(error);
    redirectWithMessage("error", "No pudimos validar el PIN. Intentá de nuevo.", ctx);
  }

  redirectWithMessage("success", "Turno iniciado. Ya podés cargar ventas.", ctx);
}

export async function lockBarberTerminal(formData: FormData) {
  const branchId = parseRequiredString(formData, "branchId");
  const terminalBarberId = parseRequiredString(formData, "terminalBarber");
  const terminalId = parseRequiredString(formData, "terminal");

  await clearBarberSessionCookie();
  redirectWithMessage("success", "Cerraste el turno.", { branchId, barberId: terminalBarberId, terminalId });
}

export async function registerBarberSale(formData: FormData) {
  const session = await getBarberSession();
  const branchId = parseRequiredString(formData, "branchId");
  const terminalBarberId = parseRequiredString(formData, "terminalBarber");
  const terminalId = parseRequiredString(formData, "terminal");
  const fallbackCtx: RedirectContext = { branchId, barberId: terminalBarberId, terminalId };

  // La identidad viene de la sesión firmada, no del formulario.
  if (!session) {
    redirectWithMessage("error", "Se cerró tu turno. Ingresá tu PIN de nuevo.", fallbackCtx);
  }

  const ctx: RedirectContext = {
    branchId: session.branchId,
    barberId: terminalBarberId,
    terminalId: session.terminalId ?? terminalId,
  };

  const parsedItems = parseSaleItemsFromFormData(formData);
  const paymentMethod = parsePaymentMethod(formData.get("paymentMethod"));

  if (parsedItems.error) {
    redirectWithMessage("error", parsedItems.error, ctx);
  }

  if (!paymentMethod) {
    redirectWithMessage("error", "Elegí un método de pago.", ctx);
  }

  try {
    await createSimpleSale({
      branchId: session.branchId,
      barberId: session.barberId,
      terminalId: session.terminalId ?? null,
      items: parsedItems.items,
      paymentMethod,
    });
  } catch (error) {
    if (error instanceof SaleError) {
      redirectWithMessage("error", getSaleErrorMessage(error.code), ctx);
    }

    console.error(error);
    redirectWithMessage("error", genericErrorMessage, ctx);
  }

  redirectWithMessage("success", "Venta registrada correctamente.", ctx);
}

function redirectWithMessage(status: "error" | "success", message: string, ctx: RedirectContext): never {
  const params = new URLSearchParams({ status, message });

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

  redirect(`/barber?${params.toString()}`);
}
