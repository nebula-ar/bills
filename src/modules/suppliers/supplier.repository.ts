import type { Prisma } from "@/generated/prisma/client";
import { ExpenseCategory, PaymentMethod, PurchaseStatus, StockMovementType, Unit } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type Tx = Prisma.TransactionClient;

export function findSuppliersForManagement(businessId: string) {
  return prisma.supplier.findMany({
    where: { businessId, deleted: false },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      taxId: true,
      phone: true,
      email: true,
      address: true,
      notes: true,
      active: true,
      _count: { select: { purchases: true } },
    },
  });
}

export function findSupplierById(supplierId: string, businessId: string) {
  return prisma.supplier.findFirst({
    where: { id: supplierId, businessId, deleted: false },
    select: {
      id: true,
      name: true,
      taxId: true,
      phone: true,
      email: true,
      address: true,
      notes: true,
      active: true,
    },
  });
}

export type SupplierWriteInput = {
  businessId: string;
  name: string;
  taxId: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
  userId?: string | null;
};

export function createSupplierRecord(input: SupplierWriteInput) {
  return prisma.supplier.create({
    data: { ...toSupplierData(input), businessId: input.businessId, createdById: input.userId },
  });
}

export function updateSupplierRecord(supplierId: string, businessId: string, input: SupplierWriteInput) {
  return prisma.supplier.update({
    // El `businessId` en el where, y no solo en el caso de uso: Prisma acepta
    // filtros no únicos junto al id en un update, así que una fila de otro
    // negocio no matchea y tira P2025 en lugar de escribir.
    where: { id: supplierId, businessId },
    data: toSupplierData(input),
  });
}

export function softDeleteSupplier(supplierId: string, businessId: string, userId?: string | null) {
  return prisma.supplier.update({
    where: { id: supplierId, businessId },
    data: { deleted: true, deletedAt: new Date(), deletedById: userId, active: false },
  });
}

function toSupplierData(input: SupplierWriteInput) {
  return {
    name: input.name,
    taxId: input.taxId,
    phone: input.phone,
    email: input.email,
    address: input.address,
    notes: input.notes,
    active: input.active,
    updatedById: input.userId,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Compras / cuentas a pagar
// ─────────────────────────────────────────────────────────────────────────────

const purchaseSelect = {
  id: true,
  number: true,
  total: true,
  declaredTotal: true,
  taxAmount: true,
  expenseCategory: true,
  status: true,
  issuedAt: true,
  dueAt: true,
  notes: true,
  stockApplied: true,
  branchId: true,
  supplier: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true } },
  payments: {
    where: { deleted: false },
    orderBy: { paidAt: "desc" as const },
    select: { id: true, amount: true, method: true, paidAt: true, note: true },
  },
  credits: {
    where: { deleted: false },
    orderBy: { issuedAt: "desc" as const },
    select: { id: true, amount: true, number: true, reason: true, issuedAt: true },
  },
  items: {
    select: {
      id: true,
      description: true,
      quantity: true,
      unit: true,
      unitCost: true,
      total: true,
      product: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.PurchaseSelect;

export function findPurchases(businessId: string, filters?: { supplierId?: string; onlyOpen?: boolean }) {
  return prisma.purchase.findMany({
    where: {
      businessId,
      deleted: false,
      ...(filters?.supplierId ? { supplierId: filters.supplierId } : {}),
      ...(filters?.onlyOpen
        ? { status: { in: [PurchaseStatus.PENDING, PurchaseStatus.PARTIAL] } }
        : {}),
    },
    orderBy: [{ dueAt: "asc" }, { issuedAt: "desc" }],
    select: purchaseSelect,
  });
}

export function findPurchaseById(purchaseId: string, businessId: string) {
  return prisma.purchase.findFirst({
    where: { id: purchaseId, businessId, deleted: false },
    select: purchaseSelect,
  });
}

export type PurchaseItemInput = {
  productId: string | null;
  description: string;
  quantity: number;
  unit: Unit;
  unitCost: number;
  total: number;
};

export type CreatePurchaseInput = {
  businessId: string;
  branchId: string | null;
  supplierId: string;
  number: string | null;
  total: number;
  declaredTotal: number | null;
  taxAmount: number | null;
  expenseCategory: ExpenseCategory | null;
  issuedAt: Date;
  dueAt: Date | null;
  notes: string | null;
  items: PurchaseItemInput[];
  userId?: string | null;
};

export function createPurchaseRecord(tx: Tx, input: CreatePurchaseInput) {
  return tx.purchase.create({
    data: {
      businessId: input.businessId,
      branchId: input.branchId,
      supplierId: input.supplierId,
      number: input.number,
      total: input.total,
      declaredTotal: input.declaredTotal,
      taxAmount: input.taxAmount,
      expenseCategory: input.expenseCategory,
      issuedAt: input.issuedAt,
      dueAt: input.dueAt,
      notes: input.notes,
      createdById: input.userId,
      updatedById: input.userId,
      items: {
        create: input.items.map((item) => ({
          productId: item.productId,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitCost: item.unitCost,
          total: item.total,
        })),
      },
    },
    select: { id: true, total: true },
  });
}

export function markPurchaseStockApplied(tx: Tx, purchaseId: string, businessId: string) {
  return tx.purchase.update({ where: { id: purchaseId, businessId }, data: { stockApplied: true } });
}

export function createPurchasePayment(input: {
  purchaseId: string;
  amount: number;
  method: PaymentMethod;
  paidAt: Date;
  note: string | null;
  userId?: string | null;
}) {
  return prisma.purchasePayment.create({
    data: {
      purchaseId: input.purchaseId,
      amount: input.amount,
      method: input.method,
      paidAt: input.paidAt,
      note: input.note,
      createdById: input.userId,
    },
  });
}

export function setPurchaseStatus(purchaseId: string, businessId: string, status: PurchaseStatus) {
  return prisma.purchase.update({ where: { id: purchaseId, businessId }, data: { status } });
}

export function createPurchaseCreditRecord(input: {
  purchaseId: string;
  amount: number;
  number: string | null;
  reason: string | null;
  issuedAt: Date;
  userId?: string | null;
}) {
  return prisma.purchaseCredit.create({
    data: {
      purchaseId: input.purchaseId,
      amount: input.amount,
      number: input.number,
      reason: input.reason,
      issuedAt: input.issuedAt,
      createdById: input.userId,
    },
  });
}

// Compras que son gasto operativo (un service, un flete, el contador): no son
// mercadería, así que bajan la ganancia del período en que se emitió la factura
// —devengado— y no cuando se pagan.
export function findOperatingPurchasesInRange(businessId: string, from?: Date, to?: Date) {
  return prisma.purchase.findMany({
    where: {
      businessId,
      deleted: false,
      status: { not: PurchaseStatus.CANCELLED },
      expenseCategory: { not: null },
      ...(from || to ? { issuedAt: { gte: from, lte: to } } : {}),
    },
    select: {
      total: true,
      taxAmount: true,
      expenseCategory: true,
      credits: { where: { deleted: false }, select: { amount: true } },
    },
  });
}

// El último ingreso por compra de un producto. Sirve para no pisar el costo de
// reposición cuando se carga una factura vieja traspapelada.
export async function findLastPurchaseMovementAt(productId: string, businessId: string) {
  const movement = await prisma.stockMovement.findFirst({
    where: { productId, product: { businessId }, type: StockMovementType.PURCHASE },
    orderBy: { occurredAt: "desc" },
    select: { occurredAt: true },
  });

  return movement?.occurredAt ?? null;
}

export function softDeletePurchase(purchaseId: string, businessId: string, userId?: string | null) {
  return prisma.purchase.update({
    where: { id: purchaseId, businessId },
    data: { deleted: true, deletedAt: new Date(), deletedById: userId },
  });
}

// Pagos a proveedores por método: para la caja son un egreso, igual que un gasto.
export async function findPurchasePaymentsByMethod(scope: {
  businessId: string;
  branchId?: string | null;
  from?: Date;
  to?: Date;
}) {
  const grouped = await prisma.purchasePayment.groupBy({
    by: ["method"],
    where: {
      deleted: false,
      purchase: {
        deleted: false,
        businessId: scope.businessId,
        ...(scope.branchId ? { branchId: scope.branchId } : {}),
      },
      ...(scope.from || scope.to
        ? {
            paidAt: {
              ...(scope.from ? { gte: scope.from } : {}),
              ...(scope.to ? { lte: scope.to } : {}),
            },
          }
        : {}),
    },
    _sum: { amount: true },
  });

  return new Map<PaymentMethod, number>(grouped.map((row) => [row.method, row._sum.amount ?? 0]));
}

// Los pagos de un rango, uno por uno (no agrupados): son los renglones que la
// pantalla de Gastos mezcla con los gastos sueltos para mostrar todo lo que
// salió en el mes.
export function findPurchasePaymentsInRange(scope: {
  businessId: string;
  branchId?: string | null;
  from: Date;
  to: Date;
}) {
  return prisma.purchasePayment.findMany({
    where: {
      deleted: false,
      paidAt: { gte: scope.from, lte: scope.to },
      purchase: {
        deleted: false,
        businessId: scope.businessId,
        ...(scope.branchId ? { branchId: scope.branchId } : {}),
      },
    },
    orderBy: { paidAt: "desc" },
    select: {
      id: true,
      amount: true,
      method: true,
      paidAt: true,
      note: true,
      purchase: {
        select: {
          id: true,
          number: true,
          supplier: { select: { id: true, name: true } },
          branch: { select: { name: true } },
        },
      },
    },
  });
}

// Productos con stock que se pueden cargar en una factura de compra.
export function findPurchasableProducts(businessId: string) {
  return prisma.product.findMany({
    where: { businessId, deleted: false, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, unit: true, cost: true, trackStock: true, sku: true },
  });
}
