import { ExpensesManager, type ExpensesData, type OutflowRow, type PayableRow } from "@/components/expenses-manager";
import { SyncfusionGestionProvider } from "@/components/syncfusion-gestion-provider";
import { AppModule, ExpenseCategory, PurchaseStatus, TaxCondition, Unit } from "@/generated/prisma/client";
import { findBusinessTaxCondition } from "@/modules/invoicing/invoicing.repository";
import { requireBusinessContext } from "@/lib/business-context";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from "@/lib/expense-labels";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_OPTIONS } from "@/lib/payment-labels";
import { unitShort } from "@/lib/quantity";
import { getBranchesForManagement } from "@/modules/branches/get-branches-for-management.use-case";
import { getExpenseBranches, getExpensesInRange } from "@/modules/expenses/expense.use-cases";
import { buildOutflowTimeline, sumOutflows } from "@/modules/expenses/outflow.logic";
import {
  findPurchasableProducts,
  findPurchasePaymentsInRange,
  getPurchases,
  getSuppliersWithDebt,
  isDueSoon,
  isOverdue,
} from "@/modules/suppliers/supplier.use-cases";

const moneyFormatter = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const dayFormatter = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });
const dueFormatter = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" });
const monthFormatter = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" });

type ExpensesPageProps = {
  searchParams: Promise<{ month?: string | string[] }>;
};

// Gastos es la pantalla de "lo que sale". Un gasto suelto y una factura de
// proveedor son la misma pregunta del dueño —¿cuánta plata se me va?— así que
// se ven juntos, aunque abajo sean dos cosas distintas: el gasto ya está pago y
// la factura es deuda hasta que se paga.
export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const { business } = await requireBusinessContext();
  const showsSuppliers = business.has(AppModule.SUPPLIERS);
  const taxCondition = await findBusinessTaxCondition(business.id);

  const params = await searchParams;
  const now = new Date();
  const monthKey = getMonthKey(params.month, now);
  const [year, month] = monthKey.split("-").map(Number);
  const from = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const to = new Date(year, month, 0, 23, 59, 59, 999);

  const [expenses, branches] = await Promise.all([
    getExpensesInRange({ businessId: business.id, from, to }),
    getExpenseBranches(business.id),
  ]);

  // Todo lo de proveedores se pide solo si el módulo está prendido: una
  // barbería que no le compra a nadie no paga estas consultas.
  const [payments, purchases, suppliers, manageableBranches, products] = showsSuppliers
    ? await Promise.all([
        findPurchasePaymentsInRange({ businessId: business.id, from, to }),
        getPurchases(business.id),
        getSuppliersWithDebt(business.id),
        getBranchesForManagement(business.id),
        findPurchasableProducts(business.id),
      ])
    : [[], null, [], [], []];

  const expenseRows: OutflowRow[] = expenses.map((expense) => ({
    kind: "EXPENSE",
    id: expense.id,
    occurredAt: expense.spentAt,
    amount: expense.amount,
    amountLabel: moneyFormatter.format(expense.amount),
    dateLabel: dayFormatter.format(expense.spentAt),
    title: EXPENSE_CATEGORY_LABELS[expense.category],
    accountLabel: PAYMENT_METHOD_LABELS[expense.paymentMethod],
    detail: [expense.branch ? expense.branch.name : "General", expense.supplier?.name, expense.note]
      .filter(Boolean)
      .join(" · "),
    expense: {
      category: expense.category,
      paymentMethod: expense.paymentMethod,
      branchId: expense.branchId,
      supplierId: expense.supplierId,
      note: expense.note,
      spentAtValue: toISODateLocal(expense.spentAt),
    },
  }));

  const paymentRows: OutflowRow[] = payments.map((payment) => ({
    kind: "PAYMENT",
    id: payment.id,
    occurredAt: payment.paidAt,
    amount: payment.amount,
    amountLabel: moneyFormatter.format(payment.amount),
    dateLabel: dayFormatter.format(payment.paidAt),
    title: `Pago a ${payment.purchase.supplier.name}`,
    accountLabel: PAYMENT_METHOD_LABELS[payment.method],
    detail: [payment.purchase.number ? `Factura ${payment.purchase.number}` : "Sin comprobante", payment.note]
      .filter(Boolean)
      .join(" · "),
    purchaseId: payment.purchase.id,
  }));

  const timeline = buildOutflowTimeline([...expenseRows, ...paymentRows]);
  const total = sumOutflows(timeline);

  // Las facturas abiertas NO dependen del mes que se esté mirando: lo que se
  // debe se debe, y esconderlo por navegar a marzo es la mejor forma de que se
  // venza.
  const payables: PayableRow[] = (purchases?.purchases ?? [])
    .filter((purchase) => purchase.pending > 0 && purchase.status !== PurchaseStatus.CANCELLED)
    .map((purchase) => {
      const payable = {
        id: purchase.id,
        total: purchase.total,
        paid: purchase.paid,
        credited: purchase.credited,
        status: purchase.status,
        dueAt: purchase.dueAt,
      };

      return {
        id: purchase.id,
        supplierName: purchase.supplier.name,
        number: purchase.number,
        branchLabel: purchase.branch?.name ?? null,
        total: purchase.total,
        totalLabel: moneyFormatter.format(purchase.total),
        paidLabel: moneyFormatter.format(purchase.paid),
        pending: purchase.pending,
        pendingLabel: moneyFormatter.format(purchase.pending),
        dueLabel: purchase.dueAt ? dueFormatter.format(purchase.dueAt) : null,
        overdue: isOverdue(payable, now),
        dueSoon: isDueSoon(payable, now),
        canCancel: purchase.paid === 0,
        creditedLabel: purchase.credited > 0 ? moneyFormatter.format(purchase.credited) : null,
        categoryLabel: purchase.expenseCategory ? EXPENSE_CATEGORY_LABELS[purchase.expenseCategory] : null,
        items: purchase.items.map((item) => ({
          id: item.id,
          label: item.product?.name ?? item.description,
          quantityLabel: `${formatQuantityLabel(item.quantity)} ${unitShort(item.unit)}`,
          totalLabel: moneyFormatter.format(item.total),
        })),
        payments: purchase.payments.map((payment) => ({
          id: payment.id,
          amountLabel: moneyFormatter.format(payment.amount),
          accountLabel: PAYMENT_METHOD_LABELS[payment.method],
          dateLabel: dueFormatter.format(payment.paidAt),
        })),
      };
    });

  const debt = payables.reduce((sum, payable) => sum + payable.pending, 0);
  const overdueCount = payables.filter((payable) => payable.overdue).length;

  const data: ExpensesData = {
    businessName: business.name,
    monthKey,
    monthLabel: capitalize(monthFormatter.format(from)),
    prevMonthKey: shiftMonth(monthKey, -1),
    nextMonthKey: shiftMonth(monthKey, 1),
    totalAmount: total,
    totalLabel: moneyFormatter.format(total),
    count: timeline.length,
    showsSuppliers,
    debtLabel: moneyFormatter.format(debt),
    hasDebt: debt > 0,
    overdueCount,
    branches: branches.map((branch) => ({ id: branch.id, name: branch.name })),
    purchaseBranches: manageableBranches.map((branch) => ({ id: branch.id, name: branch.name })),
    categories: EXPENSE_CATEGORIES.map((category) => ({ value: category, label: EXPENSE_CATEGORY_LABELS[category] })),
    merchandiseCategory: ExpenseCategory.MERCHANDISE,
    showsVat: taxCondition === TaxCondition.RESPONSABLE_INSCRIPTO,
    paymentMethods: PAYMENT_METHOD_OPTIONS,
    suppliers: suppliers.map((supplier) => ({
      id: supplier.id,
      name: supplier.name,
      contact: supplier.phone ?? supplier.taxId ?? null,
      active: supplier.active,
      purchaseCount: supplier.purchaseCount,
      debt: supplier.debt,
      debtLabel: supplier.debt > 0 ? moneyFormatter.format(supplier.debt) : null,
    })),
    products: products.map((product) => ({
      id: product.id,
      label: `${product.name} (${unitShort(product.unit)})`,
    })),
    // Las unidades viajan resueltas desde acá: el enum de Prisma no puede
    // cruzar al bundle del navegador (ver AGENTS.md).
    units: Object.values(Unit).map((unit) => ({ value: unit, label: unitShort(unit) })),
    todayValue: toISODateLocal(now),
    outflows: timeline,
    payables,
  };

  return (
    <SyncfusionGestionProvider>
      <ExpensesManager data={data} />
    </SyncfusionGestionProvider>
  );
}

// La cantidad viene en milésimas (ver src/lib/quantity.ts); acá solo hace falta
// mostrarla sin ceros de relleno.
function formatQuantityLabel(milli: number) {
  const value = milli / 1000;
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "").replace(".", ",");
}

function getMonthKey(value: string | string[] | undefined, now: Date) {
  const single = Array.isArray(value) ? value[0] : value;
  if (single && /^\d{4}-\d{2}$/.test(single)) {
    return single;
  }
  return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}`;
}

function shiftMonth(monthKey: string, delta: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`;
}

function toISODateLocal(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
