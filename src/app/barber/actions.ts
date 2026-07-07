"use server";

import { clearBarberSessionCookie, getBarberSession, setBarberSessionCookie } from "@/lib/barber-session";
import { getBarberErrorMessage } from "@/lib/barber-error-messages";
import { getSaleErrorMessage } from "@/lib/sale-error-messages";
import { parsePaymentMethod, parseRequiredString } from "@/lib/sale-form-parser";
import { BarberError } from "@/modules/barbers/barber.errors";
import { validateBarberPin } from "@/modules/barbers/validate-barber-pin.use-case";
import { createSimpleSale } from "@/modules/sales/create-simple-sale.use-case";
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
