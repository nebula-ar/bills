import { AppointmentStatus, CustomerAccountEntryType } from "@/generated/prisma/client";
import { logEvent } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "node:crypto";

import { checkRedeem, loyaltyBalance, pointsValue, type LoyaltyRules } from "./loyalty.logic";
import { topPairs } from "./basket.logic";
import {
  birthdaysInMonth,
  lapsedCustomers,
  topCustomers,
  DEFAULT_LAPSED_DAYS,
  type CustomerActivity,
} from "./marketing.logic";
import { MarketingError, MarketingErrorCode } from "./marketing.errors";
import { findCustomerActivity, findLoyaltyBalances, findRecentBaskets } from "./marketing.repository";

// Cuántos días de ventas se miran para el análisis de canasta. Tres meses es
// suficiente para ver un patrón y no tan viejo como para que ya no aplique.
const BASKET_DAYS = 90;

export type MarketingOverview = {
  lapsed: ReturnType<typeof lapsedCustomers>;
  birthdays: ReturnType<typeof birthdaysInMonth>;
  top: CustomerActivity[];
  pairs: ReturnType<typeof topPairs>;
  customers: CustomerActivity[];
  loyaltyBalances: Map<string, number>;
};

export async function getMarketingOverview(input: {
  businessId: string;
  now: Date;
  lapsedDays?: number;
}): Promise<MarketingOverview> {
  const from = new Date(input.now);
  from.setDate(from.getDate() - BASKET_DAYS);

  const [customers, baskets, loyaltyBalances] = await Promise.all([
    findCustomerActivity(input.businessId),
    findRecentBaskets(input.businessId, from),
    findLoyaltyBalances(input.businessId),
  ]);

  return {
    lapsed: lapsedCustomers(customers, input.now, input.lapsedDays ?? DEFAULT_LAPSED_DAYS),
    birthdays: birthdaysInMonth(customers, input.now),
    top: topCustomers(customers),
    pairs: topPairs(baskets),
    customers,
    loyaltyBalances,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuración
// ─────────────────────────────────────────────────────────────────────────────

export type MarketingSettingsInput = {
  businessId: string;
  publicPageActive: boolean;
  publicNote?: string | null;
  googleReviewUrl?: string | null;
  pointsPerAmount?: number | null;
  pointValue?: number | null;
  userId?: string | null;
};

export async function updateMarketingSettings(input: MarketingSettingsInput) {
  const business = await prisma.business.findFirst({
    where: { id: input.businessId, deleted: false },
    select: { id: true, publicToken: true },
  });

  if (!business) {
    throw new MarketingError(MarketingErrorCode.BUSINESS_NOT_FOUND);
  }

  if (input.googleReviewUrl && !isHttpUrl(input.googleReviewUrl)) {
    throw new MarketingError(MarketingErrorCode.INVALID_URL);
  }

  for (const value of [input.pointsPerAmount, input.pointValue]) {
    if (value != null && (!Number.isInteger(value) || value <= 0)) {
      throw new MarketingError(MarketingErrorCode.INVALID_POINTS_RULE);
    }
  }

  await prisma.business.update({
    where: { id: business.id },
    data: {
      publicPageActive: input.publicPageActive,
      // El token se genera la primera vez que se prende la página y no se toca
      // más: si cambiara, se romperían los links ya compartidos.
      publicToken: business.publicToken ?? randomBytes(12).toString("base64url"),
      publicNote: input.publicNote?.trim() || null,
      googleReviewUrl: input.googleReviewUrl?.trim() || null,
      pointsPerAmount: input.pointsPerAmount ?? null,
      pointValue: input.pointValue ?? null,
      updatedById: input.userId,
    },
  });

  await logEvent("marketing.settings", "Configuración de marketing actualizada", {
    businessId: input.businessId,
    userId: input.userId ?? undefined,
    context: { publicPageActive: input.publicPageActive },
  });
}

export function getMarketingSettings(businessId: string) {
  return prisma.business.findFirst({
    where: { id: businessId, deleted: false },
    select: {
      publicToken: true,
      publicPageActive: true,
      publicNote: true,
      googleReviewUrl: true,
      pointsPerAmount: true,
      pointValue: true,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Puntos
// ─────────────────────────────────────────────────────────────────────────────

export async function getCustomerPoints(customerId: string, businessId: string) {
  const [entries, business] = await Promise.all([
    prisma.loyaltyEntry.findMany({ where: { customerId, businessId }, select: { points: true } }),
    prisma.business.findFirst({
      where: { id: businessId },
      select: { pointsPerAmount: true, pointValue: true },
    }),
  ]);

  const rules: LoyaltyRules = {
    pointsPerAmount: business?.pointsPerAmount ?? null,
    pointValue: business?.pointValue ?? null,
  };
  const balance = loyaltyBalance(entries);

  return { balance, value: pointsValue(balance, rules), rules };
}

// Canjear puntos deja dos asientos: el descuento de puntos y un crédito en la
// cuenta del cliente. Van juntos en una transacción — si se descontaran los
// puntos sin acreditar la plata, el cliente los perdió.
export async function redeemPoints(input: {
  businessId: string;
  customerId: string;
  points: number;
  branchId?: string | null;
  userId?: string | null;
}) {
  const { balance, rules } = await getCustomerPoints(input.customerId, input.businessId);
  const check = checkRedeem(input.points, balance, rules);

  if (!check.ok) {
    throw new MarketingError(
      check.error === "NOT_ENOUGH_POINTS"
        ? MarketingErrorCode.NOT_ENOUGH_POINTS
        : check.error === "DISABLED"
          ? MarketingErrorCode.LOYALTY_DISABLED
          : MarketingErrorCode.INVALID_POINTS,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.loyaltyEntry.create({
      data: {
        businessId: input.businessId,
        customerId: input.customerId,
        points: -check.points,
        note: `Canje por $${check.value}`,
        createdById: input.userId,
      },
    });

    // Importe negativo = crédito a favor del cliente, igual que un pago.
    await tx.customerAccountEntry.create({
      data: {
        customerId: input.customerId,
        branchId: input.branchId ?? null,
        type: CustomerAccountEntryType.ADJUSTMENT,
        amount: -check.value,
        note: `Canje de ${check.points} puntos`,
        createdById: input.userId,
      },
    });
  });

  await logEvent("marketing.loyalty.redeem", `Canje de ${check.points} puntos por $${check.value}`, {
    businessId: input.businessId,
    userId: input.userId ?? undefined,
    context: { customerId: input.customerId, points: check.points, value: check.value },
  });

  return { points: check.points, value: check.value };
}

// ─────────────────────────────────────────────────────────────────────────────
// Página pública
// ─────────────────────────────────────────────────────────────────────────────

// Se busca SOLO por token y solo si está prendida: apagarla tiene que dejar el
// link muerto en el acto.
export async function getPublicBusiness(token: string) {
  return prisma.business.findFirst({
    where: { publicToken: token, publicPageActive: true, deleted: false },
    select: {
      id: true,
      name: true,
      vertical: true,
      publicNote: true,
      publicToken: true,
      branches: {
        where: { deleted: false, active: true },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, address: true },
      },
    },
  });
}

// Catálogo de la página pública: solo lo que está a la venta en esa sucursal.
export async function getPublicCatalog(businessId: string, branchId: string) {
  const prices = await prisma.branchProductPrice.findMany({
    where: {
      branchId,
      deleted: false,
      active: true,
      product: { deleted: false, active: true, businessId },
    },
    orderBy: { product: { name: "asc" } },
    select: {
      price: true,
      product: {
        select: {
          id: true,
          name: true,
          unit: true,
          imageUpdatedAt: true,
          catalogSlug: true,
          category: { select: { name: true } },
        },
      },
    },
  });

  return prices.map((row) => ({
    id: row.product.id,
    name: row.product.name,
    price: row.price,
    unit: row.product.unit,
    categoryName: row.product.category?.name ?? null,
    imageVersion: row.product.imageUpdatedAt?.getTime() ?? null,
    catalogSlug: row.product.catalogSlug,
  }));
}

// Servicios agendables y quién los atiende, para la reserva pública.
export async function getPublicBookingOptions(businessId: string, branchId: string) {
  const [staffs, prices] = await Promise.all([
    prisma.user.findMany({
      where: { businessId, branchId, deleted: false, active: true, role: "STAFF" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.branchProductPrice.findMany({
      where: { branchId, deleted: false, active: true, product: { deleted: false, active: true, businessId } },
      orderBy: { product: { name: "asc" } },
      select: { price: true, product: { select: { id: true, name: true } } },
    }),
  ]);

  return {
    staffs,
    services: prices.map((row) => ({ id: row.product.id, name: row.product.name, price: row.price })),
  };
}

// Turnos ya tomados de un día, para no ofrecer un horario ocupado. Se devuelve
// lo mínimo: quién y cuándo. La página pública no muestra de quién es el turno.
export async function getPublicDayAppointments(businessId: string, branchId: string, day: Date) {
  const from = new Date(day);
  from.setHours(0, 0, 0, 0);
  const to = new Date(day);
  to.setHours(23, 59, 59, 999);

  const appointments = await prisma.appointment.findMany({
    where: {
      businessId,
      branchId,
      deleted: false,
      startsAt: { gte: from, lte: to },
      status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
    },
    select: { staffId: true, startsAt: true, durationMinutes: true },
  });

  return appointments;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
