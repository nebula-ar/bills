"use server";

import { AppModule } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { logError } from "@/lib/logger";
import {
  findGruposDelNegocio,
  findGruposDeProducto,
  togglearGrupoDeProducto,
} from "@/modules/catalog/modifiers.repository";

/**
 * Qué opciones se le ofrecen a este producto.
 *
 * Los grupos —"Punto de cocción", "Agregados"— se definen en `/opciones`, que
 * sigue existiendo: son un catálogo compartido del negocio, igual que las
 * categorías o las promociones, y no propiedad de un producto. Lo que faltaba
 * era poder ver y elegir, desde el producto, cuáles lleva: para prenderle uno
 * había que ir a la otra pantalla y buscarlo en una lista de checkboxes.
 */

export type GrupoDeOpciones = {
  id: string;
  name: string;
  required: boolean;
  opciones: number;
  activo: boolean;
};

export type OpcionesResult = { ok: true; grupos: GrupoDeOpciones[] } | { ok: false; error: string };
export type OpcionesMutationResult = { ok: true } | { ok: false; error: string };

export async function getProductModifierGroups(productId: string): Promise<OpcionesResult> {
  const { session } = await requireModule(AppModule.TABLES);

  try {
    const [todos, suyos] = await Promise.all([
      findGruposDelNegocio(session.user.businessId),
      findGruposDeProducto(session.user.businessId, productId),
    ]);

    const activos = new Set(suyos.map((grupo) => grupo.id));

    return {
      ok: true,
      grupos: todos.map((grupo) => ({
        id: grupo.id,
        name: grupo.name,
        required: grupo.required,
        opciones: grupo._count.modifiers,
        activo: activos.has(grupo.id),
      })),
    };
  } catch (error) {
    await logError("modifiers.read", error, {
      businessId: session.user.businessId,
      userId: session.user.id,
      context: { productId },
    });
    return { ok: false, error: "No pudimos leer las opciones." };
  }
}

export async function toggleProductModifierGroup(input: {
  productId: string;
  groupId: string;
  incluir: boolean;
}): Promise<OpcionesMutationResult> {
  const { session } = await requireModule(AppModule.TABLES);

  try {
    await togglearGrupoDeProducto({
      businessId: session.user.businessId,
      groupId: input.groupId,
      productId: input.productId,
      incluir: input.incluir,
    });

    return { ok: true };
  } catch (error) {
    await logError("modifiers.toggle", error, {
      businessId: session.user.businessId,
      userId: session.user.id,
      context: { productId: input.productId, groupId: input.groupId },
    });
    return { ok: false, error: "No pudimos guardar las opciones. Intentá de nuevo." };
  }
}
