import { QuoteStatus, Unit } from "@/generated/prisma/client";
import { logEvent } from "@/lib/logger";
import { lineTotal } from "@/lib/quantity";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "node:crypto";

import { QuoteError, QuoteErrorCode } from "./quote.errors";
import { defaultValidUntil, quoteTotals } from "./quote.logic";

export type QuoteLineDraft = {
  productId?: string | null;
  description: string;
  quantity: number;
  unit?: Unit;
  unitPrice: number;
};

export type CreateQuoteInput = {
  businessId: string;
  branchId: string;
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  lines: QuoteLineDraft[];
  discount?: number;
  notes?: string | null;
  validUntil?: Date | null;
  userId?: string | null;
  now?: Date;
};

export async function createQuote(input: CreateQuoteInput) {
  const now = input.now ?? new Date();
  const lines = input.lines.filter((line) => line.description.trim().length > 0);

  if (lines.length === 0) {
    throw new QuoteError(QuoteErrorCode.EMPTY_QUOTE);
  }

  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new QuoteError(QuoteErrorCode.INVALID_LINE);
    }
    if (!Number.isInteger(line.unitPrice) || line.unitPrice < 0) {
      throw new QuoteError(QuoteErrorCode.INVALID_LINE);
    }
  }

  const validUntil = input.validUntil ?? defaultValidUntil(now);

  if (Number.isNaN(validUntil.getTime())) {
    throw new QuoteError(QuoteErrorCode.INVALID_VALIDITY);
  }

  const branch = await prisma.branch.findFirst({
    where: { id: input.branchId, businessId: input.businessId, deleted: false, active: true },
    select: { id: true },
  });

  if (!branch) {
    throw new QuoteError(QuoteErrorCode.BRANCH_NOT_FOUND);
  }

  const totals = quoteTotals(lines, input.discount ?? 0);

  const quote = await prisma.$transaction(async (tx) => {
    // Numeración por negocio. Se lee dentro de la transacción para que dos
    // presupuestos cargados a la vez no salgan con el mismo número.
    const last = await tx.quote.findFirst({
      where: { businessId: input.businessId },
      orderBy: { number: "desc" },
      select: { number: true },
    });

    return tx.quote.create({
      data: {
        businessId: input.businessId,
        branchId: branch.id,
        number: (last?.number ?? 0) + 1,
        customerId: input.customerId ?? null,
        customerName: input.customerName?.trim() || null,
        customerPhone: input.customerPhone?.trim() || null,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        total: totals.total,
        notes: input.notes?.trim() || null,
        validUntil,
        publicToken: randomBytes(16).toString("base64url"),
        createdById: input.userId,
        updatedById: input.userId,
        items: {
          create: lines.map((line) => ({
            productId: line.productId ?? null,
            description: line.description.trim(),
            quantity: line.quantity,
            unit: line.unit ?? Unit.UNIT,
            unitPrice: line.unitPrice,
            total: lineTotal(line.quantity, line.unitPrice),
          })),
        },
      },
      select: { id: true, number: true, publicToken: true },
    });
  });

  await logEvent("quote.create", `Presupuesto #${quote.number} por $${totals.total}`, {
    businessId: input.businessId,
    userId: input.userId ?? undefined,
    context: { quoteId: quote.id, total: totals.total, lines: lines.length },
  });

  return quote;
}

const QUOTE_SELECT = {
  id: true,
  number: true,
  status: true,
  customerName: true,
  customerPhone: true,
  subtotal: true,
  discountTotal: true,
  total: true,
  notes: true,
  validUntil: true,
  publicToken: true,
  saleId: true,
  createdAt: true,
  customer: { select: { id: true, name: true, phone: true } },
  branch: { select: { id: true, name: true } },
  items: {
    where: { deleted: false },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      productId: true,
      description: true,
      quantity: true,
      unit: true,
      unitPrice: true,
      total: true,
    },
  },
} as const;

export async function getQuotes(businessId: string) {
  return prisma.quote.findMany({
    where: { businessId, deleted: false },
    orderBy: { number: "desc" },
    select: QUOTE_SELECT,
  });
}

export async function getQuote(quoteId: string, businessId: string) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, businessId, deleted: false },
    select: QUOTE_SELECT,
  });

  if (!quote) {
    throw new QuoteError(QuoteErrorCode.QUOTE_NOT_FOUND);
  }

  return quote;
}

// Vista pública: se busca SOLO por token, sin sesión. Por eso el token es
// random de 16 bytes y no el id — un id secuencial se adivina.
export async function getPublicQuote(token: string) {
  return prisma.quote.findFirst({
    where: { publicToken: token, deleted: false },
    select: {
      ...QUOTE_SELECT,
      business: { select: { name: true } },
    },
  });
}

export async function setQuoteStatus(input: {
  quoteId: string;
  businessId: string;
  status: QuoteStatus;
  userId?: string | null;
}) {
  const quote = await getQuote(input.quoteId, input.businessId);

  if (quote.status === QuoteStatus.CONVERTED) {
    throw new QuoteError(QuoteErrorCode.ALREADY_CONVERTED);
  }

  await prisma.quote.update({
    where: { id: quote.id },
    data: { status: input.status, updatedById: input.userId },
  });

  await logEvent("quote.status", `Presupuesto #${quote.number}: ${input.status}`, {
    businessId: input.businessId,
    userId: input.userId ?? undefined,
    context: { quoteId: quote.id, status: input.status },
  });
}

export async function deleteQuote(input: { quoteId: string; businessId: string; userId?: string | null }) {
  const quote = await getQuote(input.quoteId, input.businessId);

  await prisma.quote.update({
    where: { id: quote.id },
    data: { deleted: true, deletedAt: new Date(), deletedById: input.userId },
  });
}

// Se llama después de cobrar: deja el presupuesto atado a la venta para que no
// se cotice dos veces lo mismo.
export async function markQuoteConverted(input: { quoteId: string; saleId: string; businessId: string }) {
  await prisma.quote.updateMany({
    where: { id: input.quoteId, businessId: input.businessId, deleted: false },
    data: { status: QuoteStatus.CONVERTED, saleId: input.saleId },
  });
}

// Renglones listos para precargar el mostrador. Solo van los que apuntan a un
// producto del catálogo: la mano de obra no tiene stock ni precio de lista.
export async function getQuoteForCheckout(quoteId: string, businessId: string) {
  const quote = await getQuote(quoteId, businessId);

  if (quote.status === QuoteStatus.CONVERTED) {
    throw new QuoteError(QuoteErrorCode.ALREADY_CONVERTED);
  }

  return {
    id: quote.id,
    number: quote.number,
    customerId: quote.customer?.id ?? null,
    branchId: quote.branch.id,
    items: quote.items
      .filter((item) => item.productId !== null)
      .map((item) => ({ productId: item.productId as string, quantity: item.quantity })),
    skipped: quote.items.filter((item) => item.productId === null).length,
  };
}
