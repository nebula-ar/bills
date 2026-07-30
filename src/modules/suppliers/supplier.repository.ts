import type { Prisma } from "@/generated/prisma/client";
import { PaymentMethod, PurchaseStatus, Unit } from "@/generated/prisma/client";
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

export function updateSupplierRecord(supplierId: string, input: SupplierWriteInput) {
  return prisma.supplier.update({
    where: { id: supplierId },
    data: toSupplierData(input),
  });
}

export function softDeleteSupplier(supplierId: string, userId?: string | null) {
  return prisma.supplier.update({
    where: { id: supplierId },
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

export function markPurchaseStockApplied(tx: Tx, purchaseId: string) {
  return tx.purchase.update({ where: { id: purchaseId }, data: { stockApplied: true } });
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

export function setPurchaseStatus(purchaseId: string, status: PurchaseStatus) {
  return prisma.purchase.update({ where: { id: purchaseId }, data: { status } });
}

export function softDeletePurchase(purchaseId: string, userId?: string | null) {
  return prisma.purchase.update({
    where: { id: purchaseId },
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

// Productos con stock que se pueden cargar en una factura de compra.
export function findPurchasableProducts(businessId: string) {
  return prisma.product.findMany({
    where: { businessId, deleted: false, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, unit: true, cost: true, trackStock: true, sku: true },
  });
}
