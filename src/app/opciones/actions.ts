"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AppModule } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { parseAmountInput } from "@/lib/money";
import {
  asignarProductos,
  borrarGrupo,
  borrarModificador,
  crearGrupo,
  crearModificador,
} from "@/modules/catalog/modifiers.repository";
import { normalizeGroupSelection, validateGroupConfig } from "@/modules/catalog/modifiers";

function texto(formData: FormData, key: string) {
  const valor = formData.get(key);
  return typeof valor === "string" ? valor.trim() : "";
}

function volver(estado: "ok" | "error", mensaje: string): never {
  redirect(`/opciones?${new URLSearchParams({ estado, mensaje }).toString()}`);
}

export async function crearGrupoAction(formData: FormData) {
  const { session } = await requireModule(AppModule.TABLES);

  const config = {
    name: texto(formData, "name"),
    required: formData.get("required") === "on",
    minSelect: Number(texto(formData, "minSelect") || "0"),
    maxSelect: Number(texto(formData, "maxSelect") || "1"),
  };

  const problema = validateGroupConfig(config);
  if (problema) volver("error", problema);

  // Un grupo obligatorio con mínimo 0 se puede saltear: la etiqueta dice una
  // cosa y la regla hace otra. Se resuelve a favor de la etiqueta.
  const limites = normalizeGroupSelection({
    required: config.required,
    minSelect: config.minSelect,
    maxSelect: config.maxSelect,
  });

  await crearGrupo({
    businessId: session.user.businessId,
    name: config.name,
    required: config.required,
    ...limites,
    userId: session.user.id,
  });

  revalidatePath("/opciones");
  volver("ok", "Grupo creado");
}

export async function crearModificadorAction(formData: FormData) {
  const { session } = await requireModule(AppModule.TABLES);

  const name = texto(formData, "name");
  if (!name) volver("error", "Poné un nombre para la opción");

  // El ajuste puede ser negativo ("sin queso −$300"), así que el signo se
  // maneja aparte del monto.
  const monto = parseAmountInput(texto(formData, "priceDelta") || "0") ?? 0;
  const priceDelta = texto(formData, "signo") === "-" ? -monto : monto;

  await crearModificador({
    businessId: session.user.businessId,
    groupId: texto(formData, "groupId"),
    name,
    priceDelta,
    userId: session.user.id,
  });

  revalidatePath("/opciones");
  volver("ok", "Opción agregada");
}

export async function asignarProductosAction(formData: FormData) {
  const { session } = await requireModule(AppModule.TABLES);

  const groupId = texto(formData, "groupId");
  const productIds = formData.getAll("productIds").filter((v): v is string => typeof v === "string");

  await asignarProductos(groupId, session.user.businessId, productIds);

  revalidatePath("/opciones");
  volver("ok", "Productos actualizados");
}

export async function borrarGrupoAction(formData: FormData) {
  const { session } = await requireModule(AppModule.TABLES);

  await borrarGrupo(texto(formData, "groupId"), session.user.businessId, session.user.id);

  revalidatePath("/opciones");
  volver("ok", "Grupo eliminado");
}

export async function borrarModificadorAction(formData: FormData) {
  const { session } = await requireModule(AppModule.TABLES);

  await borrarModificador(texto(formData, "modifierId"), session.user.businessId, session.user.id);

  revalidatePath("/opciones");
  volver("ok", "Opción eliminada");
}
