"use server";

import { requireAdminSession } from "@/lib/auth";
import { logError } from "@/lib/logger";
import {
  createBranchTerminal,
  deleteBranchTerminal,
  updateBranchTerminal,
} from "@/modules/terminals/terminal.use-cases";
import { redirect } from "next/navigation";

function parseString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createTerminalAction(formData: FormData) {
  const session = await requireAdminSession();

  const branchId = parseString(formData, "branchId");
  const name = parseString(formData, "name");
  const staffId = parseString(formData, "staffId") || null;

  if (!branchId || !name) {
    redirectWithMessage("error", "Elegí sucursal y poné un nombre para la terminal.", branchId);
  }

  try {
    await createBranchTerminal({ businessId: session.user.businessId, branchId, name, staffId });
  } catch (error) {
    await logError("terminal.create", error, { businessId: session.user.businessId, userId: session.user.id });
    redirectWithMessage("error", "No pudimos crear la terminal. Revisá el empleado elegido.", branchId);
  }

  redirectWithMessage("success", "Terminal creada.", branchId);
}

export async function renameTerminalAction(formData: FormData) {
  const session = await requireAdminSession();

  const branchId = parseString(formData, "branchId");
  const terminalId = parseString(formData, "terminalId");
  const name = parseString(formData, "name");
  const staffId = parseString(formData, "staffId") || null;

  if (!terminalId || !name) {
    redirectWithMessage("error", "Poné un nombre para la terminal.", branchId);
  }

  try {
    await updateBranchTerminal({ businessId: session.user.businessId, terminalId, name, staffId });
  } catch (error) {
    await logError("terminal.update", error, { businessId: session.user.businessId, userId: session.user.id });
    redirectWithMessage("error", "No pudimos actualizar la terminal. Revisá el empleado elegido.", branchId);
  }

  redirectWithMessage("success", "Terminal actualizada.", branchId);
}

export type TerminalActionResult = { ok: boolean; message: string };

export async function deleteTerminalAction(formData: FormData): Promise<TerminalActionResult> {
  const session = await requireAdminSession();

  const terminalId = parseString(formData, "terminalId");

  if (!terminalId) {
    return { ok: false, message: "No encontramos la terminal." };
  }

  try {
    await deleteBranchTerminal({ businessId: session.user.businessId, terminalId });
  } catch (error) {
    await logError("terminal.delete", error, { businessId: session.user.businessId, userId: session.user.id });
    return { ok: false, message: "No pudimos borrar la terminal. Intentá de nuevo." };
  }

  return { ok: true, message: "Terminal borrada." };
}

function redirectWithMessage(status: "error" | "success", message: string, branchId?: string): never {
  const params = new URLSearchParams({ status, message });
  if (branchId) {
    params.set("branchId", branchId);
  }
  redirect(`/terminals?${params.toString()}`);
}
