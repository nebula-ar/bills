import { EXPENSE_CATEGORY_LABELS } from "@/lib/expense-labels";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-labels";
import { prisma } from "@/lib/prisma";
import { formatQuantity } from "@/lib/quantity";

import { csvDate, csvDateTime, csvMoney, toCsv } from "./csv.logic";

// Exportar para el contador.
//
// Una fila por ítem y no por venta: el contador necesita ver qué se vendió, y
// una venta con cinco renglones colapsada en una línea no le sirve para nada.
// El número de venta se repite en cada fila para que pueda agrupar en la
// planilla.

export type ExportDataset = "ventas" | "gastos" | "compras" | "inventario";

export const EXPORT_DATASETS: { value: ExportDataset; label: string; hint: string }[] = [
  { value: "ventas", label: "Ventas", hint: "Una fila por producto vendido, con costo y margen" },
  { value: "gastos", label: "Gastos", hint: "Qué se gastó, de qué cuenta salió y en qué rubro" },
  { value: "compras", label: "Compras", hint: "Facturas de proveedores con su estado de pago" },
  // Sin la existencia final el contador no puede cerrar el ejercicio: le falta
  // justo la mitad que la compra dejó en la góndola.
  { value: "inventario", label: "Inventario", hint: "Existencia final valuada, para cerrar el ejercicio" },
];

export function isExportDataset(value: string): value is ExportDataset {
  return EXPORT_DATASETS.some((dataset) => dataset.value === value);
}

export async function buildExport(input: {
  businessId: string;
  dataset: ExportDataset;
  from: Date;
  to: Date;
}): Promise<string> {
  if (input.dataset === "gastos") {
    return buildExpensesCsv(input.businessId, input.from, input.to);
  }

  if (input.dataset === "compras") {
    return buildPurchasesCsv(input.businessId, input.from, input.to);
  }

  if (input.dataset === "inventario") {
    return buildInventoryCsv(input.businessId);
  }

  return buildSalesCsv(input.businessId, input.from, input.to);
}

// Existencia final valuada al promedio ponderado de cada sucursal. Es la foto
// del patrimonio en mercadería: lo que la compra dejó en la góndola.
async function buildInventoryCsv(businessId: string) {
  const products = await prisma.product.findMany({
    where: { businessId, deleted: false, active: true, trackStock: true },
    orderBy: { name: "asc" },
    select: {
      name: true,
      sku: true,
      unit: true,
      cost: true,
      stockLevels: {
        where: { quantity: { not: 0 } },
        select: { quantity: true, avgCost: true, branch: { select: { name: true } } },
      },
    },
  });

  const rows: (string | number | null)[][] = [
    ["Sucursal", "Producto", "SKU", "Existencia", "Costo promedio", "Valuación", "Costo de reposición"],
  ];

  for (const product of products) {
    for (const level of product.stockLevels) {
      const cost = level.avgCost ?? product.cost;

      rows.push([
        level.branch.name,
        product.name,
        product.sku ?? "",
        formatQuantity(level.quantity, product.unit),
        cost ? csvMoney(cost) : "",
        cost ? csvMoney(Math.round((cost * Math.max(level.quantity, 0)) / 1000)) : "",
        product.cost ? csvMoney(product.cost) : "",
      ]);
    }
  }

  return toCsv(rows);
}

async function buildSalesCsv(businessId: string, from: Date, to: Date) {
  const sales = await prisma.sale.findMany({
    where: {
      deleted: false,
      soldAt: { gte: from, lte: to },
      branch: { businessId, deleted: false },
    },
    orderBy: { soldAt: "asc" },
    select: {
      id: true,
      soldAt: true,
      subtotal: true,
      discountTotal: true,
      total: true,
      customerName: true,
      customerTaxId: true,
      cae: true,
      branch: { select: { name: true } },
      staff: { select: { name: true } },
      customer: { select: { name: true, taxId: true } },
      items: {
        where: { deleted: false },
        select: {
          description: true,
          quantity: true,
          unit: true,
          unitPrice: true,
          discount: true,
          total: true,
          unitCost: true,
        },
      },
      payments: { where: { deleted: false }, select: { method: true, amount: true } },
    },
  });

  const rows: (string | number | null)[][] = [
    [
      "Fecha",
      "Venta",
      "Sucursal",
      "Vendedor",
      "Cliente",
      "CUIT/DNI",
      "Producto",
      "Cantidad",
      "Precio unitario",
      "Descuento",
      "Importe",
      // El costo de lo vendido es lo que le faltaba al contador para armar el
      // resultado: con las compras solas no puede separar lo que se vendió de
      // lo que quedó en la góndola.
      "Costo unitario",
      "Costo del renglón",
      "Medios de pago",
      "Total de la venta",
      "CAE",
    ],
  ];

  for (const sale of sales) {
    // Los medios de pago viven en la venta, no en el ítem: se repiten en cada
    // fila del comprobante para que ninguna quede sin contexto.
    const methods = sale.payments
      .map((payment) => `${PAYMENT_METHOD_LABELS[payment.method]} ${payment.amount}`)
      .join(" + ");

    for (const item of sale.items) {
      rows.push([
        csvDateTime(sale.soldAt),
        shortId(sale.id),
        sale.branch.name,
        sale.staff.name,
        sale.customer?.name ?? sale.customerName ?? "Consumidor final",
        sale.customer?.taxId ?? sale.customerTaxId ?? "",
        item.description,
        formatQuantity(item.quantity, item.unit),
        csvMoney(item.unitPrice),
        csvMoney(item.discount),
        csvMoney(item.total),
        item.unitCost ? csvMoney(item.unitCost) : "",
        item.unitCost ? csvMoney(Math.round((item.unitCost * item.quantity) / 1000)) : "",
        methods,
        csvMoney(sale.total),
        sale.cae ?? "",
      ]);
    }
  }

  return toCsv(rows);
}

async function buildExpensesCsv(businessId: string, from: Date, to: Date) {
  const expenses = await prisma.expense.findMany({
    where: { businessId, deleted: false, spentAt: { gte: from, lte: to } },
    orderBy: { spentAt: "asc" },
    select: {
      spentAt: true,
      category: true,
      paymentMethod: true,
      amount: true,
      note: true,
      branch: { select: { name: true } },
      supplier: { select: { name: true } },
    },
  });

  const rows: (string | number | null)[][] = [
    ["Fecha", "Sucursal", "Rubro", "Proveedor", "Cuenta", "Detalle", "Importe"],
  ];

  for (const expense of expenses) {
    rows.push([
      csvDate(expense.spentAt),
      expense.branch?.name ?? "",
      EXPENSE_CATEGORY_LABELS[expense.category],
      expense.supplier?.name ?? "",
      PAYMENT_METHOD_LABELS[expense.paymentMethod],
      expense.note ?? "",
      csvMoney(expense.amount),
    ]);
  }

  return toCsv(rows);
}

async function buildPurchasesCsv(businessId: string, from: Date, to: Date) {
  const purchases = await prisma.purchase.findMany({
    where: { businessId, deleted: false, issuedAt: { gte: from, lte: to } },
    orderBy: { issuedAt: "asc" },
    select: {
      issuedAt: true,
      dueAt: true,
      number: true,
      total: true,
      taxAmount: true,
      expenseCategory: true,
      status: true,
      supplier: { select: { name: true, taxId: true } },
      branch: { select: { name: true } },
      payments: { where: { deleted: false }, select: { amount: true } },
      credits: { where: { deleted: false }, select: { amount: true } },
    },
  });

  const rows: (string | number | null)[][] = [
    [
      "Fecha",
      "Vencimiento",
      "Proveedor",
      "CUIT",
      "Sucursal",
      "Comprobante",
      "Concepto",
      "Total",
      "IVA",
      "Notas de crédito",
      "Pagado",
      "Saldo",
      "Estado",
    ],
  ];

  for (const purchase of purchases) {
    const paid = purchase.payments.reduce((sum, payment) => sum + payment.amount, 0);
    const credited = purchase.credits.reduce((sum, credit) => sum + credit.amount, 0);

    rows.push([
      csvDate(purchase.issuedAt),
      purchase.dueAt ? csvDate(purchase.dueAt) : "",
      purchase.supplier.name,
      purchase.supplier.taxId ?? "",
      purchase.branch?.name ?? "",
      purchase.number ?? "",
      purchase.expenseCategory ? EXPENSE_CATEGORY_LABELS[purchase.expenseCategory] : "Mercadería",
      csvMoney(purchase.total),
      purchase.taxAmount ? csvMoney(purchase.taxAmount) : "",
      credited > 0 ? csvMoney(credited) : "",
      csvMoney(paid),
      csvMoney(Math.max(purchase.total - paid - credited, 0)),
      purchase.status,
    ]);
  }

  return toCsv(rows);
}

// Los ids son cuid: el contador no los va a tipear, pero necesita un
// identificador estable para agrupar las filas de una misma venta.
function shortId(id: string) {
  return id.slice(-6).toUpperCase();
}
