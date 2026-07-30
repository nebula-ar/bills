import { PaymentMethod, StockMovementType, Unit } from "@/generated/prisma/client";
import { logEvent } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { validateTaxId } from "@/lib/tax-id";
import { applyStockMovement } from "@/modules/stock/stock.repository";

import { pendingAmount, resolvePurchaseStatus, summarizePayables } from "./purchase.logic";
import { SupplierError, SupplierErrorCode } from "./supplier.errors";
import {
  createPurchasePayment,
  createPurchaseRecord,
  createSupplierRecord,
  findPurchaseById,
  findPurchases,
  findSupplierById,
  findSuppliersForManagement,
  markPurchaseStockApplied,
  setPurchaseStatus,
  softDeletePurchase,
  softDeleteSupplier,
  updateSupplierRecord,
  type PurchaseItemInput,
  type SupplierWriteInput,
} from "./supplier.repository";

export { findPurchasePaymentsByMethod, findPurchasableProducts } from "./supplier.repository";
export { summarizePayables, pendingAmount, isOverdue, isDueSoon } from "./purchase.logic";

// ─────────────────────────────────────────────────────────────────────────────
// Proveedores
// ─────────────────────────────────────────────────────────────────────────────

export type SupplierInput = {
  businessId: string;
  name: string;
  taxId?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  active?: boolean;
  userId?: string | null;
};

export async function getSuppliersWithDebt(businessId: string) {
  const [suppliers, purchases] = await Promise.all([
    findSuppliersForManagement(businessId),
    findPurchases(businessId, { onlyOpen: true }),
  ]);

  const debtBySupplier = new Map<string, number>();

  for (const purchase of purchases) {
    const paid = sumPayments(purchase.payments);
    const pending = pendingAmount({ total: purchase.total, paid, status: purchase.status });

    if (pending > 0) {
      debtBySupplier.set(purchase.supplier.id, (debtBySupplier.get(purchase.supplier.id) ?? 0) + pending);
    }
  }

  return suppliers.map((supplier) => ({
    id: supplier.id,
    name: supplier.name,
    taxId: supplier.taxId,
    phone: supplier.phone,
    email: supplier.email,
    address: supplier.address,
    notes: supplier.notes,
    active: supplier.active,
    purchaseCount: supplier._count.purchases,
    debt: debtBySupplier.get(supplier.id) ?? 0,
  }));
}

export async function createSupplier(input: SupplierInput) {
  const data = validateSupplier(input);
  const supplier = await createSupplierRecord(data);

  await logEvent("supplier.create", `Proveedor creado: ${data.name}`, {
    businessId: input.businessId,
    userId: input.userId ?? undefined,
    context: { supplierId: supplier.id },
  });

  return supplier;
}

export async function updateSupplier(supplierId: string, input: SupplierInput) {
  await requireSupplier(supplierId, input.businessId);

  const data = validateSupplier(input);
  const supplier = await updateSupplierRecord(supplierId, data);

  await logEvent("supplier.update", `Proveedor actualizado: ${data.name}`, {
    businessId: input.businessId,
    userId: input.userId ?? undefined,
    context: { supplierId },
  });

  return supplier;
}

export async function deleteSupplier(supplierId: string, businessId: string, userId?: string | null) {
  const supplier = await requireSupplier(supplierId, businessId);

  await softDeleteSupplier(supplierId, userId);

  await logEvent("supplier.delete", `Proveedor eliminado: ${supplier.name}`, {
    businessId,
    userId: userId ?? undefined,
    context: { supplierId },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Facturas de compra
// ─────────────────────────────────────────────────────────────────────────────

export type PurchaseView = Awaited<ReturnType<typeof getPurchases>>["purchases"][number];

// Listado de cuentas a pagar, con lo pagado y lo que falta ya resueltos.
export async function getPurchases(businessId: string, filters?: { supplierId?: string; onlyOpen?: boolean }) {
  const rows = await findPurchases(businessId, filters);

  const purchases = rows.map((purchase) => {
    const paid = sumPayments(purchase.payments);

    return {
      ...purchase,
      paid,
      pending: pendingAmount({ total: purchase.total, paid, status: purchase.status }),
    };
  });

  return {
    purchases,
    summary: summarizePayables(
      purchases.map((purchase) => ({
        id: purchase.id,
        total: purchase.total,
        paid: purchase.paid,
        status: purchase.status,
        dueAt: purchase.dueAt,
      })),
      new Date(),
    ),
  };
}

export async function getPurchaseDetail(purchaseId: string, businessId: string) {
  const purchase = await findPurchaseById(purchaseId, businessId);

  if (!purchase) {
    throw new SupplierError(SupplierErrorCode.PURCHASE_NOT_FOUND);
  }

  const paid = sumPayments(purchase.payments);

  return { ...purchase, paid, pending: pendingAmount({ total: purchase.total, paid, status: purchase.status }) };
}

export type PurchaseInput = {
  businessId: string;
  branchId?: string | null;
  supplierId: string;
  number?: string | null;
  issuedAt: Date;
  dueAt?: Date | null;
  notes?: string | null;
  items: { productId?: string | null; description: string; quantity: number; unit?: Unit; unitCost: number }[];
  userId?: string | null;
};

// Cargar una factura de compra hace dos cosas de una: registra la deuda con el
// proveedor y mete la mercadería en el stock de la sucursal. Todo en una
// transacción — nunca queremos stock que entró sin factura ni al revés.
export async function createPurchase(input: PurchaseInput) {
  const supplier = await requireSupplier(input.supplierId, input.businessId);

  if (input.items.length === 0) {
    throw new SupplierError(SupplierErrorCode.EMPTY_ITEMS);
  }

  const items: PurchaseItemInput[] = input.items.map((item) => {
    const description = item.description.trim();

    if (!description || !Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new SupplierError(SupplierErrorCode.INVALID_ITEM);
    }

    if (!Number.isInteger(item.unitCost) || item.unitCost < 0) {
      throw new SupplierError(SupplierErrorCode.INVALID_ITEM);
    }

    return {
      productId: item.productId ?? null,
      description,
      quantity: item.quantity,
      unit: item.unit ?? Unit.UNIT,
      unitCost: item.unitCost,
      // El costo unitario es "por unidad de medida" y la cantidad viene en
      // milésimas, así que el renglón se calcula igual que en una venta.
      total: Math.round((item.unitCost * item.quantity) / 1000),
    };
  });

  const total = items.reduce((sum, item) => sum + item.total, 0);
  const branchId = input.branchId ?? null;

  // Solo mueve stock lo que apunta a un producto con seguimiento activado.
  const trackedProductIds = items.flatMap((item) => (item.productId ? [item.productId] : []));
  const tracked = trackedProductIds.length
    ? await prisma.product.findMany({
        where: { id: { in: trackedProductIds }, businessId: input.businessId, trackStock: true, deleted: false },
        select: { id: true },
      })
    : [];
  const trackedIds = new Set(tracked.map((product) => product.id));

  if (trackedIds.size > 0 && !branchId) {
    throw new SupplierError(SupplierErrorCode.BRANCH_REQUIRED_FOR_STOCK);
  }

  const purchase = await prisma.$transaction(async (tx) => {
    const created = await createPurchaseRecord(tx, {
      businessId: input.businessId,
      branchId,
      supplierId: input.supplierId,
      number: input.number?.trim() || null,
      total,
      issuedAt: input.issuedAt,
      dueAt: input.dueAt ?? null,
      notes: input.notes?.trim() || null,
      items,
      userId: input.userId,
    });

    if (branchId) {
      for (const item of items) {
        if (!item.productId || !trackedIds.has(item.productId)) {
          continue;
        }

        await applyStockMovement(tx, {
          branchId,
          productId: item.productId,
          type: StockMovementType.PURCHASE,
          quantity: item.quantity,
          unitCost: item.unitCost,
          reason: `Compra a ${supplier.name}`,
          purchaseId: created.id,
          occurredAt: input.issuedAt,
          createdById: input.userId,
        });

        // El último costo pagado es el costo de reposición vigente.
        await tx.product.update({ where: { id: item.productId }, data: { cost: item.unitCost } });
      }

      if (trackedIds.size > 0) {
        await markPurchaseStockApplied(tx, created.id);
      }
    }

    return created;
  });

  await logEvent("purchase.create", `Compra a ${supplier.name} por $${total}`, {
    businessId: input.businessId,
    userId: input.userId ?? undefined,
    context: { purchaseId: purchase.id, supplierId: input.supplierId, total, items: items.length, branchId },
  });

  return purchase;
}

// Pago (total o parcial) de una factura. Recalcula el estado a partir de la
// plata pagada, nunca lo setea a mano.
export async function registerPurchasePayment(input: {
  purchaseId: string;
  businessId: string;
  amount: number;
  method: PaymentMethod;
  paidAt?: Date;
  note?: string | null;
  userId?: string | null;
}) {
  const purchase = await getPurchaseDetail(input.purchaseId, input.businessId);

  if (purchase.status === "CANCELLED") {
    throw new SupplierError(SupplierErrorCode.PURCHASE_CANCELLED);
  }

  if (purchase.pending <= 0) {
    throw new SupplierError(SupplierErrorCode.PURCHASE_ALREADY_PAID);
  }

  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new SupplierError(SupplierErrorCode.INVALID_AMOUNT);
  }

  if (input.amount > purchase.pending) {
    throw new SupplierError(SupplierErrorCode.PAYMENT_EXCEEDS_PENDING, {
      pending: purchase.pending,
      attempted: input.amount,
    });
  }

  await createPurchasePayment({
    purchaseId: input.purchaseId,
    amount: input.amount,
    method: input.method,
    paidAt: input.paidAt ?? new Date(),
    note: input.note?.trim() || null,
    userId: input.userId,
  });

  const paid = purchase.paid + input.amount;
  await setPurchaseStatus(input.purchaseId, resolvePurchaseStatus(purchase.total, paid));

  await logEvent("purchase.payment", `Pago de $${input.amount} a ${purchase.supplier.name}`, {
    businessId: input.businessId,
    userId: input.userId ?? undefined,
    context: { purchaseId: input.purchaseId, amount: input.amount, method: input.method, paid, total: purchase.total },
  });

  return { paid, pending: purchase.total - paid };
}

export async function cancelPurchase(purchaseId: string, businessId: string, userId?: string | null) {
  const purchase = await getPurchaseDetail(purchaseId, businessId);

  await setPurchaseStatus(purchaseId, resolvePurchaseStatus(purchase.total, purchase.paid, true));

  await logEvent("purchase.cancel", `Compra anulada a ${purchase.supplier.name}`, {
    businessId,
    userId: userId ?? undefined,
    context: { purchaseId },
  });
}

export async function deletePurchase(purchaseId: string, businessId: string, userId?: string | null) {
  await getPurchaseDetail(purchaseId, businessId);
  await softDeletePurchase(purchaseId, userId);

  await logEvent("purchase.delete", "Compra eliminada", {
    businessId,
    userId: userId ?? undefined,
    context: { purchaseId },
  });
}

async function requireSupplier(supplierId: string, businessId: string) {
  const supplier = await findSupplierById(supplierId, businessId);

  if (!supplier) {
    throw new SupplierError(SupplierErrorCode.SUPPLIER_NOT_FOUND);
  }

  return supplier;
}

function validateSupplier(input: SupplierInput): SupplierWriteInput {
  const name = input.name.trim();

  if (!name) {
    throw new SupplierError(SupplierErrorCode.INVALID_NAME);
  }

  const taxId = input.taxId?.trim() || null;

  if (taxId && !validateTaxId(taxId).valid) {
    throw new SupplierError(SupplierErrorCode.INVALID_TAX_ID);
  }

  return {
    businessId: input.businessId,
    name,
    taxId,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    address: input.address?.trim() || null,
    notes: input.notes?.trim() || null,
    active: input.active ?? true,
    userId: input.userId,
  };
}

function sumPayments(payments: { amount: number }[]): number {
  return payments.reduce((sum, payment) => sum + payment.amount, 0);
}
