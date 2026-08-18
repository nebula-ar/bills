import { ExpenseCategory, PaymentMethod, PurchaseStatus, StockMovementType, Unit } from "@/generated/prisma/client";
import { logEvent } from "@/lib/logger";
import { movesCash } from "@/lib/payment-labels";
import { prisma } from "@/lib/prisma";
import { validateTaxId } from "@/lib/tax-id";
import { applyStockMovement, reverseStockEntry, type Tx } from "@/modules/stock/stock.repository";

import { declaredTotalGap, pendingAmount, resolvePurchaseStatus, summarizePayables } from "./purchase.logic";
import { SupplierError, SupplierErrorCode } from "./supplier.errors";
import {
  createPurchaseCreditRecord,
  createPurchasePayment,
  createPurchaseRecord,
  createSupplierRecord,
  findLastPurchaseMovementAt,
  findPurchaseById,
  findPurchases,
  findSupplierById,
  findSuppliersForManagement,
  markPurchaseStockApplied,
  setPurchaseStatus,
  softDeleteSupplier,
  updateSupplierRecord,
  type PurchaseItemInput,
  type SupplierWriteInput,
} from "./supplier.repository";

export { findPurchasePaymentsByMethod, findPurchasePaymentsInRange, findPurchasableProducts } from "./supplier.repository";
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
  const supplier = await updateSupplierRecord(supplierId, input.businessId, data);

  await logEvent("supplier.update", `Proveedor actualizado: ${data.name}`, {
    businessId: input.businessId,
    userId: input.userId ?? undefined,
    context: { supplierId },
  });

  return supplier;
}

export async function deleteSupplier(supplierId: string, businessId: string, userId?: string | null) {
  const supplier = await requireSupplier(supplierId, businessId);

  await softDeleteSupplier(supplierId, businessId, userId);

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
    const credited = sumPayments(purchase.credits);

    return {
      ...purchase,
      paid,
      credited,
      gap: declaredTotalGap(purchase.total, purchase.declaredTotal),
      pending: pendingAmount({ total: purchase.total, paid, credited, status: purchase.status }),
    };
  });

  return {
    purchases,
    summary: summarizePayables(
      purchases.map((purchase) => ({
        id: purchase.id,
        total: purchase.total,
        paid: purchase.paid,
        credited: purchase.credited,
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
  const credited = sumPayments(purchase.credits);

  return {
    ...purchase,
    paid,
    credited,
    gap: declaredTotalGap(purchase.total, purchase.declaredTotal),
    pending: pendingAmount({ total: purchase.total, paid, credited, status: purchase.status }),
  };
}

export type PurchaseInput = {
  businessId: string;
  branchId?: string | null;
  supplierId: string;
  number?: string | null;
  issuedAt: Date;
  dueAt?: Date | null;
  notes?: string | null;
  // Lo que dice el papel, para contrastar contra la suma de los renglones.
  declaredTotal?: number | null;
  // IVA discriminado (solo Responsable Inscripto): crédito fiscal, no costo.
  taxAmount?: number | null;
  // null = mercadería. Cualquier otra cosa es un gasto operativo y no entra al
  // stock aunque los renglones nombren productos.
  expenseCategory?: ExpenseCategory | null;
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
  // Una factura de servicios (el arreglo del freezer, un flete) no es
  // mercadería: no entra al stock aunque los renglones nombren productos, y
  // baja la ganancia del período en que se emitió.
  const isMerchandise = !input.expenseCategory;

  // Solo mueve stock lo que apunta a un producto con seguimiento activado.
  const trackedProductIds = isMerchandise ? items.flatMap((item) => (item.productId ? [item.productId] : [])) : [];
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

  // Cargar hoy una factura de hace tres meses no puede pisar el costo de
  // reposición de hoy: el margen de todo lo que se venda después saldría mal
  // hasta la próxima compra. El promedio ponderado sí se recalcula igual — esa
  // mercadería entró de verdad.
  const lastPurchaseAt = new Map<string, Date | null>();
  for (const productId of trackedIds) {
    lastPurchaseAt.set(productId, await findLastPurchaseMovementAt(productId));
  }

  const purchase = await prisma.$transaction(async (tx) => {
    const created = await createPurchaseRecord(tx, {
      businessId: input.businessId,
      branchId,
      supplierId: input.supplierId,
      number: input.number?.trim() || null,
      total,
      declaredTotal: input.declaredTotal ?? null,
      taxAmount: input.taxAmount ?? null,
      expenseCategory: input.expenseCategory ?? null,
      issuedAt: input.issuedAt,
      dueAt: input.dueAt ?? null,
      notes: input.notes?.trim() || null,
      items,
      userId: input.userId,
    });

    if (branchId && isMerchandise) {
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

        const previous = lastPurchaseAt.get(item.productId) ?? null;
        if (!previous || input.issuedAt >= previous) {
          // Es la compra más reciente: su precio es el costo de reposición.
          await tx.product.update({ where: { id: item.productId }, data: { cost: item.unitCost } });
        }
      }

      if (trackedIds.size > 0) {
        await markPurchaseStockApplied(tx, created.id, input.businessId);
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

  // A un proveedor no se le paga "en cuenta corriente": eso no es un pago, es
  // seguir debiendo. Si entrara, la caja restaría plata que nunca salió.
  if (!movesCash(input.method)) {
    throw new SupplierError(SupplierErrorCode.INVALID_PAYMENT_METHOD);
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
  await setPurchaseStatus(input.purchaseId, input.businessId, resolvePurchaseStatus(purchase.total, paid, false, purchase.credited));

  await logEvent("purchase.payment", `Pago de $${input.amount} a ${purchase.supplier.name}`, {
    businessId: input.businessId,
    userId: input.userId ?? undefined,
    context: { purchaseId: input.purchaseId, amount: input.amount, method: input.method, paid, total: purchase.total },
  });

  return { paid, pending: purchase.pending - input.amount };
}

// Un solo pago que salda varias facturas del mismo proveedor. Es como cobra un
// distribuidor en la vida real: pasa, te cobra un número y ese número cubre los
// comprobantes que quedaron. Se imputa de la más vieja a la más nueva.
export async function registerSupplierPayment(input: {
  businessId: string;
  supplierId: string;
  amount: number;
  method: PaymentMethod;
  paidAt?: Date;
  note?: string | null;
  userId?: string | null;
}) {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new SupplierError(SupplierErrorCode.INVALID_AMOUNT);
  }

  if (!movesCash(input.method)) {
    throw new SupplierError(SupplierErrorCode.INVALID_PAYMENT_METHOD);
  }

  const supplier = await requireSupplier(input.supplierId, input.businessId);
  const { purchases } = await getPurchases(input.businessId, { supplierId: input.supplierId, onlyOpen: true });

  // De la más vieja a la más nueva: es lo que hace cualquiera y lo que espera
  // el proveedor.
  const open = purchases
    .filter((purchase) => purchase.pending > 0)
    .sort((a, b) => a.issuedAt.getTime() - b.issuedAt.getTime());

  const debt = open.reduce((sum, purchase) => sum + purchase.pending, 0);

  if (debt <= 0) {
    throw new SupplierError(SupplierErrorCode.PURCHASE_ALREADY_PAID);
  }

  if (input.amount > debt) {
    throw new SupplierError(SupplierErrorCode.PAYMENT_EXCEEDS_PENDING, { pending: debt, attempted: input.amount });
  }

  let left = input.amount;
  const applied: { purchaseId: string; amount: number }[] = [];

  for (const purchase of open) {
    if (left <= 0) break;

    const amount = Math.min(left, purchase.pending);
    left -= amount;
    applied.push({ purchaseId: purchase.id, amount });

    await createPurchasePayment({
      purchaseId: purchase.id,
      amount,
      method: input.method,
      paidAt: input.paidAt ?? new Date(),
      note: input.note?.trim() || null,
      userId: input.userId,
    });

    await setPurchaseStatus(
      purchase.id,
      input.businessId,
      resolvePurchaseStatus(purchase.total, purchase.paid + amount, false, purchase.credited),
    );
  }

  await logEvent("purchase.payment.bulk", `Pago de $${input.amount} a ${supplier.name} (${applied.length} factura/s)`, {
    businessId: input.businessId,
    userId: input.userId ?? undefined,
    context: { supplierId: input.supplierId, amount: input.amount, method: input.method, applied },
  });

  return { applied, remaining: debt - input.amount };
}

// Nota de crédito del proveedor: baja lo que le debés sin mover plata. No toca
// la caja —no salió nada— y por eso no es un pago.
export async function registerPurchaseCredit(input: {
  purchaseId: string;
  businessId: string;
  amount: number;
  number?: string | null;
  reason?: string | null;
  issuedAt?: Date;
  userId?: string | null;
}) {
  const purchase = await getPurchaseDetail(input.purchaseId, input.businessId);

  if (purchase.status === PurchaseStatus.CANCELLED) {
    throw new SupplierError(SupplierErrorCode.PURCHASE_CANCELLED);
  }

  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new SupplierError(SupplierErrorCode.INVALID_AMOUNT);
  }

  if (input.amount > purchase.pending) {
    throw new SupplierError(SupplierErrorCode.CREDIT_EXCEEDS_PENDING, {
      pending: purchase.pending,
      attempted: input.amount,
    });
  }

  await createPurchaseCreditRecord({
    purchaseId: input.purchaseId,
    amount: input.amount,
    number: input.number?.trim() || null,
    reason: input.reason?.trim() || null,
    issuedAt: input.issuedAt ?? new Date(),
    userId: input.userId,
  });

  const credited = purchase.credited + input.amount;
  await setPurchaseStatus(input.purchaseId, input.businessId, resolvePurchaseStatus(purchase.total, purchase.paid, false, credited));

  await logEvent("purchase.credit", `Nota de crédito de $${input.amount} de ${purchase.supplier.name}`, {
    businessId: input.businessId,
    userId: input.userId ?? undefined,
    context: { purchaseId: input.purchaseId, amount: input.amount, credited },
  });

  return { credited, pending: purchase.pending - input.amount };
}

// Anular una compra tiene que sacar del stock lo que esa compra metió. Si no,
// queda mercadería fantasma: valuada en el patrimonio, vendible en el POS y
// haciendo que el inventario nunca cierre contra el conteo físico. Se asientan
// movimientos compensatorios, nunca se borra el original (ver AGENTS.md).
export async function cancelPurchase(purchaseId: string, businessId: string, userId?: string | null) {
  const purchase = await getPurchaseDetail(purchaseId, businessId);

  if (purchase.status === PurchaseStatus.CANCELLED) {
    throw new SupplierError(SupplierErrorCode.PURCHASE_CANCELLED);
  }

  await prisma.$transaction(async (tx) => {
    await revertPurchaseStock(tx, purchase, userId);
    await tx.purchase.update({
      where: { id: purchaseId },
      data: { status: resolvePurchaseStatus(purchase.total, purchase.paid, true), stockApplied: false },
    });
  });

  await logEvent("purchase.cancel", `Compra anulada a ${purchase.supplier.name}`, {
    businessId,
    userId: userId ?? undefined,
    context: { purchaseId, stockReverted: purchase.stockApplied },
  });
}

export async function deletePurchase(purchaseId: string, businessId: string, userId?: string | null) {
  const purchase = await getPurchaseDetail(purchaseId, businessId);

  await prisma.$transaction(async (tx) => {
    await revertPurchaseStock(tx, purchase, userId);
    await tx.purchase.update({
      where: { id: purchaseId },
      data: { deleted: true, deletedAt: new Date(), deletedById: userId, stockApplied: false },
    });
  });

  await logEvent("purchase.delete", "Compra eliminada", {
    businessId,
    userId: userId ?? undefined,
    context: { purchaseId, stockReverted: purchase.stockApplied },
  });
}

// Saca del stock lo que la compra había metido, renglón por renglón y al costo
// con el que entró. Si la compra nunca movió stock, no hace nada.
async function revertPurchaseStock(
  tx: Tx,
  purchase: Awaited<ReturnType<typeof getPurchaseDetail>>,
  userId?: string | null,
) {
  if (!purchase.stockApplied || !purchase.branchId) {
    return;
  }

  for (const item of purchase.items) {
    if (!item.product) {
      continue;
    }

    await reverseStockEntry(tx, {
      branchId: purchase.branchId,
      productId: item.product.id,
      quantity: item.quantity,
      unitCost: item.unitCost,
      reason: `Compra anulada a ${purchase.supplier.name}`,
      purchaseId: purchase.id,
      createdById: userId,
    });
  }
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
