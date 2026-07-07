"use server";

import { requireAdminSession } from "@/lib/auth";
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
  const barberId = parseString(formData, "barberId") || null;

  if (!branchId || !name) {
    redirectWithMessage("error", "Elegí sucursal y poné un nombre para la terminal.", branchId);
  }

  try {
    await createBranchTerminal({ businessId: session.user.businessId, branchId, name, barberId });
  } catch (error) {
    console.error(error);
    redirectWithMessage("error", "No pudimos crear la terminal. Revisá el barbero elegido.", branchId);
  }

  redirectWithMessage("success", "Terminal creada.", branchId);
}

export async function renameTerminalAction(formData: FormData) {
  const session = await requireAdminSession();

  const branchId = parseString(formData, "branchId");
  const terminalId = parseString(formData, "terminalId");
  const name = parseString(formData, "name");
  const barberId = parseString(formData, "barberId") || null;

  if (!terminalId || !name) {
    redirectWithMessage("error", "Poné un nombre para la terminal.", branchId);
  }

  try {
    await updateBranchTerminal({ businessId: session.user.businessId, terminalId, name, barberId });
  } catch (error) {
    console.error(error);
    redirectWithMessage("error", "No pudimos actualizar la terminal. Revisá el barbero elegido.", branchId);
  }

  redirectWithMessage("success", "Terminal actualizada.", branchId);
}

export async function deleteTerminalAction(formData: FormData) {
  const session = await requireAdminSession();

  const branchId = parseString(formData, "branchId");
  const terminalId = parseString(formData, "terminalId");

  if (!terminalId) {
    redirectWithMessage("error", "No encontramos la terminal.", branchId);
  }

  try {
    await deleteBranchTerminal({ businessId: session.user.businessId, terminalId });
  } catch (error) {
    console.error(error);
    redirectWithMessage("error", "No pudimos borrar la terminal. Intentá de nuevo.", branchId);
  }

  redirectWithMessage("success", "Terminal borrada.", branchId);
}

function redirectWithMessage(status: "error" | "success", message: string, branchId?: string): never {
  const params = new URLSearchParams({ status, message });
  if (branchId) {
    params.set("branchId", branchId);
  }
  redirect(`/terminals?${params.toString()}`);
}
