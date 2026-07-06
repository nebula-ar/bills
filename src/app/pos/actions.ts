"use server";

import { requireAdminSession } from "@/lib/auth";
import {
  createBranchTerminal,
  deleteBranchTerminal,
  renameBranchTerminal,
} from "@/modules/terminals/terminal.use-cases";
import { revalidatePath } from "next/cache";

function parseString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createTerminalAction(formData: FormData) {
  await requireAdminSession();

  const branchId = parseString(formData, "branchId");
  const name = parseString(formData, "name");

  if (!branchId || !name) {
    return;
  }

  try {
    await createBranchTerminal({ branchId, name });
  } catch (error) {
    console.error(error);
  }

  revalidatePath("/pos");
}

export async function renameTerminalAction(formData: FormData) {
  await requireAdminSession();

  const terminalId = parseString(formData, "terminalId");
  const name = parseString(formData, "name");

  if (!terminalId || !name) {
    return;
  }

  try {
    await renameBranchTerminal({ terminalId, name });
  } catch (error) {
    console.error(error);
  }

  revalidatePath("/pos");
}

export async function deleteTerminalAction(formData: FormData) {
  await requireAdminSession();

  const terminalId = parseString(formData, "terminalId");

  if (!terminalId) {
    return;
  }

  try {
    await deleteBranchTerminal(terminalId);
  } catch (error) {
    console.error(error);
  }

  revalidatePath("/pos");
}
