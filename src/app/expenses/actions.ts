"use server";

import { AppModule, PaymentMethod, Unit } from "@/generated/prisma/client";
import { requireAdminSession } from "@/lib/auth";
import { requireModule } from "@/lib/business-context";
import { parseExpenseCategory } from "@/lib/expense-labels";
import { logError } from "@/lib/logger";
import { parsePaymentMethodValue } from "@/lib/payment-labels";
import { parseQuantityInput } from "@/lib/quantity";
import { getSupplierErrorMessageFor } from "@/lib/supplier-error-messages";
import {
  createBusinessExpense,
  deleteBusinessExpense,
  updateBusinessExpense,
} from "@/modules/expenses/expense.use-cases";
import { SupplierError } from "@/modules/suppliers/supplier.errors";
import {
  cancelPurchase,
  createPurchase,
  createSupplier,
  deletePurchase,
  deleteSupplier,
  registerPurchaseCredit,
  registerPurchasePayment,
  registerSupplierPayment,
} from "@/modules/suppliers/supplier.use-cases";

// Gastos y compras a proveedor son las dos caras de lo que sale, así que
// comparten pantalla y comparten este archivo.
//
// Todas devuelven resultado en vez de redirigir: la pantalla se queda donde
// está y el cliente hace `router.refresh()`. Con `redirect()` + flash en la URL
// el router puede servir el árbol que ya tenía y mostrar los datos de antes
// aunque la base ya esté escrita (ver AGENTS.md).
export type ActionResult = { ok: boolean; message: string };

function parseString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseAmount(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isInteger(amount) && amount > 0 ? amount : null;
}

// Costos: a diferencia de un monto, un renglón puede valer 0 (una bonificación).
function parseCost(value: string): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function parseDay(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  // Inicio del día local: así un gasto de "hoy" siempre queda dentro del rango
  // "Hoy" del dashboard (que va desde el inicio del día hasta el instante actual).
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0);
}

function parseUnit(value: string): Unit {
  return (Object.values(Unit) as string[]).includes(value) ? (value as Unit) : Unit.UNIT;
}

const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

function formatPesos(value: number) {
  return pesos.format(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// Gastos
// ─────────────────────────────────────────────────────────────────────────────

export async function createExpenseAction(formData: FormData): Promise<ActionResult> {
  const session = await requireAdminSession();

  const category = parseExpenseCategory(formData.get("category"));
  const amount = parseAmount(parseString(formData, "amount"));

  if (!category || !amount) {
    return { ok: false, message: "Completá categoría y un monto válido." };
  }

  try {
    await createBusinessExpense({
      businessId: session.user.businessId,
      branchId: parseString(formData, "branchId") || null,
      supplierId: parseString(formData, "supplierId") || null,
      category,
      paymentMethod: parsePaymentMethodValue(formData.get("paymentMethod")) ?? PaymentMethod.CASH,
      amount,
      note: parseString(formData, "note") || null,
      spentAt: parseDay(parseString(formData, "spentAt")) ?? new Date(),
    });
  } catch (error) {
    await logError("expense.create", error, { businessId: session.user.businessId, userId: session.user.id });
    return { ok: false, message: "No pudimos guardar el gasto. Intentá de nuevo." };
  }

  return { ok: true, message: "Gasto registrado." };
}

export async function updateExpenseAction(formData: FormData): Promise<ActionResult> {
  const session = await requireAdminSession();

  const expenseId = parseString(formData, "expenseId");
  const category = parseExpenseCategory(formData.get("category"));
  const amount = parseAmount(parseString(formData, "amount"));

  if (!expenseId || !category || !amount) {
    return { ok: false, message: "Completá categoría y un monto válido." };
  }

  try {
    await updateBusinessExpense({
      businessId: session.user.businessId,
      expenseId,
      branchId: parseString(formData, "branchId") || null,
      supplierId: parseString(formData, "supplierId") || null,
      category,
      paymentMethod: parsePaymentMethodValue(formData.get("paymentMethod")) ?? PaymentMethod.CASH,
      amount,
      note: parseString(formData, "note") || null,
      spentAt: parseDay(parseString(formData, "spentAt")) ?? new Date(),
    });
  } catch (error) {
    await logError("expense.update", error, { businessId: session.user.businessId, userId: session.user.id });
    return { ok: false, message: "No pudimos actualizar el gasto. Intentá de nuevo." };
  }

  return { ok: true, message: "Gasto actualizado." };
}

export async function deleteExpenseAction(formData: FormData): Promise<ActionResult> {
  const session = await requireAdminSession();
  const expenseId = parseString(formData, "expenseId");

  if (!expenseId) {
    return { ok: false, message: "No encontramos el gasto." };
  }

  try {
    await deleteBusinessExpense({ businessId: session.user.businessId, expenseId });
  } catch (error) {
    await logError("expense.delete", error, { businessId: session.user.businessId, userId: session.user.id });
    return { ok: false, message: "No pudimos borrar el gasto. Intentá de nuevo." };
  }

  return { ok: true, message: "Gasto borrado." };
}

// ─────────────────────────────────────────────────────────────────────────────
// Proveedores y facturas de compra
// ─────────────────────────────────────────────────────────────────────────────

export async function createSupplierAction(formData: FormData): Promise<ActionResult> {
  const { session } = await requireModule(AppModule.SUPPLIERS);

  try {
    await createSupplier({
      businessId: session.user.businessId,
      userId: session.user.id,
      name: parseString(formData, "name"),
      taxId: parseString(formData, "taxId") || null,
      phone: parseString(formData, "phone") || null,
      email: parseString(formData, "email") || null,
      address: parseString(formData, "address") || null,
    });
  } catch (error) {
    return await handleSupplierError(error, "supplier.create", session.user.businessId, session.user.id);
  }

  return { ok: true, message: "Proveedor creado." };
}

export async function deleteSupplierAction(formData: FormData): Promise<ActionResult> {
  const { session } = await requireModule(AppModule.SUPPLIERS);

  try {
    await deleteSupplier(parseString(formData, "supplierId"), session.user.businessId, session.user.id);
  } catch (error) {
    return await handleSupplierError(error, "supplier.delete", session.user.businessId, session.user.id);
  }

  return { ok: true, message: "Proveedor eliminado." };
}

// Carga una factura de compra con sus renglones. Los ítems vienen como campos
// paralelos (itemProductId[], itemQuantity[]...) porque el formulario es HTML puro.
export async function createPurchaseAction(formData: FormData): Promise<ActionResult> {
  const { session } = await requireModule(AppModule.SUPPLIERS);

  const productIds = formData.getAll("itemProductId").map(String);
  const descriptions = formData.getAll("itemDescription").map(String);
  const quantities = formData.getAll("itemQuantity").map(String);
  const units = formData.getAll("itemUnit").map(String);
  const costs = formData.getAll("itemUnitCost").map(String);

  const items = productIds
    .map((productId, index) => ({
      productId: productId || null,
      description: descriptions[index]?.trim() ?? "",
      quantity: parseQuantityInput(quantities[index] ?? "") ?? 0,
      unit: parseUnit(units[index] ?? ""),
      unitCost: parseCost(costs[index] ?? "") ?? 0,
    }))
    // Renglones vacíos: el formulario ofrece varias filas y no hace falta llenarlas todas.
    .filter((item) => item.quantity > 0 && (item.productId || item.description));

  if (items.length === 0) {
    return { ok: false, message: "Cargá al menos un ítem con cantidad." };
  }

  // Una factura de servicios no es mercadería: no entra al stock y sí baja la
  // ganancia. Vacío = mercadería, que es el caso de siempre.
  const categoryRaw = parseString(formData, "expenseCategory");
  const expenseCategory = categoryRaw ? parseExpenseCategory(categoryRaw) : null;

  const declaredTotal = parseCost(parseString(formData, "declaredTotal"));
  const total = items.reduce((sum, item) => sum + Math.round((item.unitCost * item.quantity) / 1000), 0);

  // Si el papel no cierra contra los renglones, se avisa antes de registrar una
  // deuda mal cargada. No se corrige solo: quizás falta un renglón, quizás es
  // una percepción — eso lo sabe el que tiene la factura en la mano.
  if (declaredTotal !== null && declaredTotal !== total) {
    const gap = declaredTotal - total;
    return {
      ok: false,
      message: `Los renglones suman ${formatPesos(total)} y el comprobante dice ${formatPesos(declaredTotal)}: ${
        gap > 0 ? `faltan ${formatPesos(gap)}` : `sobran ${formatPesos(-gap)}`
      }. Revisá los ítems o dejá el total del comprobante vacío.`,
    };
  }

  try {
    await createPurchase({
      businessId: session.user.businessId,
      userId: session.user.id,
      branchId: parseString(formData, "branchId") || null,
      supplierId: parseString(formData, "supplierId"),
      number: parseString(formData, "number") || null,
      issuedAt: parseDay(parseString(formData, "issuedAt")) ?? new Date(),
      dueAt: parseDay(parseString(formData, "dueAt")),
      notes: parseString(formData, "notes") || null,
      declaredTotal,
      taxAmount: parseCost(parseString(formData, "taxAmount")),
      expenseCategory,
      items,
    });
  } catch (error) {
    return await handleSupplierError(error, "purchase.create", session.user.businessId, session.user.id);
  }

  return { ok: true, message: "Factura cargada." };
}

// Un solo pago que salda varias facturas del proveedor, de la más vieja a la
// más nueva. Es como cobra un distribuidor en la vida real.
export async function paySupplierAction(formData: FormData): Promise<ActionResult> {
  const { session } = await requireModule(AppModule.SUPPLIERS);

  const amount = parseAmount(parseString(formData, "amount"));

  if (!amount) {
    return { ok: false, message: "Ingresá un importe válido." };
  }

  try {
    const result = await registerSupplierPayment({
      businessId: session.user.businessId,
      userId: session.user.id,
      supplierId: parseString(formData, "supplierId"),
      amount,
      method: parsePaymentMethodValue(formData.get("method")) ?? PaymentMethod.CASH,
      paidAt: parseDay(parseString(formData, "paidAt")) ?? new Date(),
      note: parseString(formData, "note") || null,
    });

    return {
      ok: true,
      message: `Pago registrado en ${result.applied.length} factura(s).`,
    };
  } catch (error) {
    return await handleSupplierError(error, "purchase.payment.bulk", session.user.businessId, session.user.id);
  }
}

// Nota de crédito: baja la deuda sin mover plata.
export async function creditPurchaseAction(formData: FormData): Promise<ActionResult> {
  const { session } = await requireModule(AppModule.SUPPLIERS);

  const amount = parseAmount(parseString(formData, "amount"));

  if (!amount) {
    return { ok: false, message: "Ingresá un importe válido." };
  }

  try {
    await registerPurchaseCredit({
      purchaseId: parseString(formData, "purchaseId"),
      businessId: session.user.businessId,
      userId: session.user.id,
      amount,
      number: parseString(formData, "number") || null,
      reason: parseString(formData, "reason") || null,
      issuedAt: parseDay(parseString(formData, "issuedAt")) ?? new Date(),
    });
  } catch (error) {
    return await handleSupplierError(error, "purchase.credit", session.user.businessId, session.user.id);
  }

  return { ok: true, message: "Nota de crédito registrada." };
}

export async function payPurchaseAction(formData: FormData): Promise<ActionResult> {
  const { session } = await requireModule(AppModule.SUPPLIERS);

  const amount = parseAmount(parseString(formData, "amount"));

  if (!amount) {
    return { ok: false, message: "Ingresá un importe válido." };
  }

  try {
    await registerPurchasePayment({
      purchaseId: parseString(formData, "purchaseId"),
      businessId: session.user.businessId,
      userId: session.user.id,
      amount,
      method: parsePaymentMethodValue(formData.get("method")) ?? PaymentMethod.CASH,
      paidAt: parseDay(parseString(formData, "paidAt")) ?? new Date(),
      note: parseString(formData, "note") || null,
    });
  } catch (error) {
    return await handleSupplierError(error, "purchase.payment", session.user.businessId, session.user.id);
  }

  return { ok: true, message: "Pago registrado." };
}

export async function cancelPurchaseAction(formData: FormData): Promise<ActionResult> {
  const { session } = await requireModule(AppModule.SUPPLIERS);

  try {
    await cancelPurchase(parseString(formData, "purchaseId"), session.user.businessId, session.user.id);
  } catch (error) {
    return await handleSupplierError(error, "purchase.cancel", session.user.businessId, session.user.id);
  }

  return { ok: true, message: "Factura anulada." };
}

export async function deletePurchaseAction(formData: FormData): Promise<ActionResult> {
  const { session } = await requireModule(AppModule.SUPPLIERS);

  try {
    await deletePurchase(parseString(formData, "purchaseId"), session.user.businessId, session.user.id);
  } catch (error) {
    return await handleSupplierError(error, "purchase.delete", session.user.businessId, session.user.id);
  }

  return { ok: true, message: "Factura eliminada." };
}

async function handleSupplierError(
  error: unknown,
  event: string,
  businessId: string,
  userId: string,
): Promise<ActionResult> {
  if (error instanceof SupplierError) {
    return { ok: false, message: getSupplierErrorMessageFor(error) };
  }

  await logError(event, error, { businessId, userId });
  return { ok: false, message: "No pudimos completar la operación. Intentá de nuevo." };
}
