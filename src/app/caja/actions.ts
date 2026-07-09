"use server";

import { PaymentMethod } from "@/generated/prisma/client";
import { requireAdminSession } from "@/lib/auth";
import { parseAmountInput } from "@/lib/money";
import { parsePaymentMethodValue } from "@/lib/payment-labels";
import {
  createBusinessCashClose,
  createBusinessTransfer,
  deleteBusinessTransfer,
  setOpeningBalance,
} from "@/modules/cash/cash.use-cases";
import { redirect } from "next/navigation";

function parseString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseAmount(value: string) {
  return parseAmountInput(value);
}

function parseBranchId(formData: FormData) {
  const value = parseString(formData, "branchId");
  return value || null;
}

function parseMovedAt(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0);
}

export async function saveOpeningBalancesAction(formData: FormData) {
  const session = await requireAdminSession();
  const branchId = parseBranchId(formData);

  try {
    for (const method of Object.values(PaymentMethod)) {
      const raw = formData.get(`opening_${method}`);
      if (typeof raw !== "string" || raw.trim() === "") continue;
      const amount = parseAmount(raw.trim());
      if (amount !== null && amount >= 0) {
        await setOpeningBalance({ businessId: session.user.businessId, branchId, paymentMethod: method, amount });
      }
    }
  } catch (error) {
    console.error(error);
    redirectWithMessage("error", "No pudimos guardar los saldos iniciales.", branchId);
  }

  redirectWithMessage("success", "Saldos iniciales actualizados.", branchId);
}

export async function createTransferAction(formData: FormData) {
  const session = await requireAdminSession();
  const branchId = parseBranchId(formData);
  const fromMethod = parsePaymentMethodValue(formData.get("fromMethod"));
  const toMethod = parsePaymentMethodValue(formData.get("toMethod"));
  const amount = parseAmount(parseString(formData, "amount"));
  const note = parseString(formData, "note") || null;
  const movedAt = parseMovedAt(parseString(formData, "movedAt"));

  if (!fromMethod || !toMethod || amount === null || amount <= 0) {
    redirectWithMessage("error", "Completá cuentas y un monto válido.", branchId);
  }
  if (fromMethod === toMethod) {
    redirectWithMessage("error", "Elegí dos cuentas distintas.", branchId);
  }

  try {
    await createBusinessTransfer({ businessId: session.user.businessId, branchId, fromMethod, toMethod, amount, note, movedAt });
  } catch (error) {
    console.error(error);
    redirectWithMessage("error", "No pudimos registrar la transferencia.", branchId);
  }

  redirectWithMessage("success", "Transferencia registrada.", branchId);
}

export async function deleteTransferAction(formData: FormData) {
  const session = await requireAdminSession();
  const branchId = parseBranchId(formData);
  const transferId = parseString(formData, "transferId");

  try {
    await deleteBusinessTransfer({ businessId: session.user.businessId, transferId });
  } catch (error) {
    console.error(error);
    redirectWithMessage("error", "No pudimos borrar la transferencia.", branchId);
  }

  redirectWithMessage("success", "Transferencia borrada.", branchId);
}

export async function createCashCloseAction(formData: FormData) {
  const session = await requireAdminSession();
  const branchId = parseBranchId(formData);
  const note = parseString(formData, "note") || null;

  const counted: Partial<Record<PaymentMethod, number>> = {};
  for (const method of Object.values(PaymentMethod)) {
    const raw = formData.get(`counted_${method}`);
    if (typeof raw === "string" && raw.trim() !== "") {
      const value = parseAmount(raw.trim());
      if (value !== null) counted[method] = value;
    }
  }

  try {
    await createBusinessCashClose({ businessId: session.user.businessId, branchId, note, counted });
  } catch (error) {
    console.error(error);
    redirectWithMessage("error", "No pudimos cerrar la caja.", branchId);
  }

  redirectWithMessage("success", "Caja cerrada.", branchId);
}

function redirectWithMessage(status: "error" | "success", message: string, branchId: string | null): never {
  const params = new URLSearchParams({ status, message });
  if (branchId) params.set("branchId", branchId);
  redirect(`/caja?${params.toString()}`);
}
