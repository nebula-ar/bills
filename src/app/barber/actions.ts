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

// El barbero se identifica con PIN una vez y abre un "turno" (sesión firmada de 8 hs).
export async function unlockBarberTerminal(formData: FormData) {
  const branchId = parseRequiredString(formData, "branchId");
  const barberId = parseRequiredString(formData, "barberId");
  const pin = parseRequiredString(formData, "pin");
  const terminalLocked = formData.get("terminalLocked") === "1";

  if (!branchId || !barberId || !pin) {
    redirectWithMessage("error", "Elegí tu perfil y poné tu PIN.", branchId, terminalLocked ? barberId : null);
  }

  try {
    await validateBarberPin({ branchId, barberId, pin });
    await setBarberSessionCookie({ branchId, barberId });
  } catch (error) {
    if (error instanceof BarberError) {
      redirectWithMessage("error", getBarberErrorMessage(error.code), branchId, terminalLocked ? barberId : null);
    }

    console.error(error);
    redirectWithMessage("error", "No pudimos validar el PIN. Intentá de nuevo.", branchId, terminalLocked ? barberId : null);
  }

  redirectWithMessage("success", "Turno iniciado. Ya podés cargar ventas.", branchId, terminalLocked ? barberId : null);
}

export async function lockBarberTerminal(formData: FormData) {
  const branchId = parseRequiredString(formData, "branchId");
  const terminalBarberId = parseRequiredString(formData, "terminalBarber");

  await clearBarberSessionCookie();
  redirectWithMessage("success", "Cerraste el turno.", branchId, terminalBarberId);
}

export async function registerBarberSale(formData: FormData) {
  const session = await getBarberSession();
  const branchId = parseRequiredString(formData, "branchId");
  const terminalBarberId = parseRequiredString(formData, "terminalBarber");

  // La identidad viene de la sesión firmada, no del formulario.
  if (!session) {
    redirectWithMessage("error", "Se cerró tu turno. Ingresá tu PIN de nuevo.", branchId, terminalBarberId);
  }

  const parsedItems = parseSaleItemsFromFormData(formData);
  const paymentMethod = parsePaymentMethod(formData.get("paymentMethod"));

  if (parsedItems.error) {
    redirectWithMessage("error", parsedItems.error, session.branchId, terminalBarberId);
  }

  if (!paymentMethod) {
    redirectWithMessage("error", "Elegí un método de pago.", session.branchId, terminalBarberId);
  }

  try {
    await createSimpleSale({
      branchId: session.branchId,
      barberId: session.barberId,
      items: parsedItems.items,
      paymentMethod,
    });
  } catch (error) {
    if (error instanceof SaleError) {
      redirectWithMessage("error", getSaleErrorMessage(error.code), session.branchId, terminalBarberId);
    }

    console.error(error);
    redirectWithMessage("error", genericErrorMessage, session.branchId, terminalBarberId);
  }

  redirectWithMessage("success", "Venta registrada correctamente.", session.branchId, terminalBarberId);
}

function redirectWithMessage(
  status: "error" | "success",
  message: string,
  branchId?: string | null,
  barberId?: string | null,
): never {
  const params = new URLSearchParams({ status, message });

  if (branchId) {
    params.set("branch", branchId);
  }

  if (barberId) {
    params.set("barber", barberId);
  }

  redirect(`/barber?${params.toString()}`);
}
