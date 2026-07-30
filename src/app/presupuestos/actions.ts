"use server";

import { AppModule, QuoteStatus } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { logError } from "@/lib/logger";
import { getQuoteErrorMessage } from "@/lib/quote-error-messages";
import { QuoteError } from "@/modules/quotes/quote.errors";
import { createQuote, deleteQuote, setQuoteStatus, type QuoteLineDraft } from "@/modules/quotes/quote.use-cases";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type CreateQuoteResult = { ok: true; id: string; number: number } | { ok: false; error: string };

export async function createQuoteAction(input: {
  branchId: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  lines: QuoteLineDraft[];
  discount?: number;
  notes?: string;
  // "YYYY-MM-DD" tal como lo escribe el input date.
  validUntil?: string;
}): Promise<CreateQuoteResult> {
  const { session } = await requireModule(AppModule.QUOTES);

  try {
    const quote = await createQuote({
      businessId: session.user.businessId,
      branchId: input.branchId,
      customerId: input.customerId || null,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      lines: input.lines,
      discount: input.discount ?? 0,
      notes: input.notes,
      validUntil: parseDay(input.validUntil),
      userId: session.user.id,
    });

    revalidatePath("/presupuestos");

    return { ok: true, id: quote.id, number: quote.number };
  } catch (error) {
    if (error instanceof QuoteError) {
      return { ok: false, error: getQuoteErrorMessage(error.code) };
    }

    await logError("quote.create", error, { businessId: session.user.businessId, userId: session.user.id });
    return { ok: false, error: "No pudimos guardar el presupuesto. Intentá de nuevo." };
  }
}

export async function setQuoteStatusAction(formData: FormData) {
  const { session } = await requireModule(AppModule.QUOTES);

  const quoteId = text(formData, "quoteId");
  const raw = text(formData, "status");
  const status = Object.values(QuoteStatus).find((value) => value === raw);

  if (!quoteId || !status) {
    back("error", "No pudimos actualizar el presupuesto.");
  }

  try {
    await setQuoteStatus({ quoteId, businessId: session.user.businessId, status, userId: session.user.id });
  } catch (error) {
    if (error instanceof QuoteError) {
      back("error", getQuoteErrorMessage(error.code));
    }

    await logError("quote.status", error, { businessId: session.user.businessId, userId: session.user.id });
    back("error", "No pudimos actualizar el presupuesto.");
  }

  back("success", status === QuoteStatus.ACCEPTED ? "Presupuesto aceptado." : "Presupuesto actualizado.");
}

export async function deleteQuoteAction(formData: FormData) {
  const { session } = await requireModule(AppModule.QUOTES);

  const quoteId = text(formData, "quoteId");

  if (!quoteId) {
    back("error", "No pudimos borrar el presupuesto.");
  }

  try {
    await deleteQuote({ quoteId, businessId: session.user.businessId, userId: session.user.id });
  } catch (error) {
    await logError("quote.delete", error, { businessId: session.user.businessId, userId: session.user.id });
    back("error", "No pudimos borrar el presupuesto.");
  }

  back("success", "Presupuesto borrado.");
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseDay(value: string | undefined): Date | null {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;

  if (!match) return null;

  const day = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  day.setHours(23, 59, 59, 999);
  return day;
}

function back(status: "success" | "error", message: string): never {
  // Igual que el resto de las acciones: sin invalidar, el router puede servir el
  // árbol viejo y el estado del presupuesto se ve sin cambiar.
  revalidatePath("/presupuestos");
  redirect(`/presupuestos?${new URLSearchParams({ status, message }).toString()}`);
}
