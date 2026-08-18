"use server";

import { AppModule } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { logError } from "@/lib/logger";
import { normalizeGroupSelection, validateGroupConfig } from "@/modules/catalog/modifiers";
import {
  borrarGrupo,
  borrarModificador,
  crearGrupo,
  crearModificador,
  findGruposDelNegocio,
  findGruposDeProducto,
  togglearGrupoDeProducto,
} from "@/modules/catalog/modifiers.repository";

/**
 * Qué opciones se le ofrecen a este producto.
 *
 * Los grupos —"Punto de cocción", "Agregados"— se crean, se eligen y se borran
 * desde acá: `/opciones` se eliminó y toda la gestión entra por el producto.
 *
 * Un grupo lo comparten varios productos, así que borrarlo los toca a todos.
 * Eso no se disimula: el tilde es de este producto, el borrado es del negocio,
 * y la pantalla lo dice con esas palabras antes y durante.
 */

export type GrupoDeOpciones = {
  id: string;
  name: string;
  required: boolean;
  opciones: { id: string; name: string; priceDelta: number }[];
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
        opciones: grupo.modifiers,
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

// ─────────────────────────────────────────────────────────────────────────────
// Alta y baja de grupos, desde la ficha
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crear un grupo y sus opciones desde el producto que las va a usar.
 *
 * El grupo nace YA asignado a ese producto: si se creó parado en la milanesa,
 * es porque la milanesa lo lleva. Obligar a crearlo y después tildarlo son dos
 * pasos para una sola intención.
 */
export async function createModifierGroup(input: {
  productId: string;
  name: string;
  required: boolean;
  maxSelect: number;
  opciones: { name: string; priceDelta: number }[];
}): Promise<OpcionesMutationResult> {
  const { session } = await requireModule(AppModule.TABLES);

  const problema = validateGroupConfig({
    name: input.name,
    required: input.required,
    minSelect: input.required ? 1 : 0,
    maxSelect: input.maxSelect,
  });

  if (problema) {
    return { ok: false, error: problema };
  }

  // Un grupo obligatorio con mínimo 0 se puede saltear: la etiqueta dice una
  // cosa y la regla hace otra. Se resuelve a favor de la etiqueta.
  const limites = normalizeGroupSelection({
    required: input.required,
    minSelect: input.required ? 1 : 0,
    maxSelect: input.maxSelect,
  });

  const opciones = input.opciones.filter((opcion) => opcion.name.trim().length > 0);

  if (opciones.length === 0) {
    return { ok: false, error: "Poné al menos una opción." };
  }

  try {
    const grupo = await crearGrupo({
      businessId: session.user.businessId,
      name: input.name.trim(),
      required: input.required,
      ...limites,
      userId: session.user.id,
    });

    for (const opcion of opciones) {
      await crearModificador({
        businessId: session.user.businessId,
        groupId: grupo.id,
        name: opcion.name.trim(),
        priceDelta: opcion.priceDelta,
        userId: session.user.id,
      });
    }

    await togglearGrupoDeProducto({
      businessId: session.user.businessId,
      groupId: grupo.id,
      productId: input.productId,
      incluir: true,
    });

    return { ok: true };
  } catch (error) {
    await logError("modifiers.create", error, {
      businessId: session.user.businessId,
      userId: session.user.id,
      context: { productId: input.productId, name: input.name },
    });
    return { ok: false, error: "No pudimos crear el grupo. Intentá de nuevo." };
  }
}

/**
 * Borra un grupo para TODO el negocio, no solo para este producto.
 *
 * Es la diferencia que hay que decir en pantalla: destildarlo acá lo saca de
 * este producto; borrarlo se lo saca a los diez que lo tenían. El borrado es
 * lógico, así que una comanda vieja que lo apuntaba sigue leyéndose.
 */
export async function deleteModifierGroup(groupId: string): Promise<OpcionesMutationResult> {
  const { session } = await requireModule(AppModule.TABLES);

  try {
    await borrarGrupo(groupId, session.user.businessId, session.user.id);
    return { ok: true };
  } catch (error) {
    await logError("modifiers.delete", error, {
      businessId: session.user.businessId,
      userId: session.user.id,
      context: { groupId },
    });
    return { ok: false, error: "No pudimos borrar el grupo. Intentá de nuevo." };
  }
}

/** Agrega una opción a un grupo que ya existe. */
export async function addModifierToGroup(input: {
  groupId: string;
  name: string;
  priceDelta: number;
}): Promise<OpcionesMutationResult> {
  const { session } = await requireModule(AppModule.TABLES);

  if (!input.name.trim()) {
    return { ok: false, error: "Poné un nombre para la opción." };
  }

  try {
    await crearModificador({
      businessId: session.user.businessId,
      groupId: input.groupId,
      name: input.name.trim(),
      priceDelta: input.priceDelta,
      userId: session.user.id,
    });

    return { ok: true };
  } catch (error) {
    await logError("modifiers.addOption", error, {
      businessId: session.user.businessId,
      userId: session.user.id,
      context: { groupId: input.groupId },
    });
    return { ok: false, error: "No pudimos agregar la opción. Intentá de nuevo." };
  }
}

/**
 * Saca una opción del grupo.
 *
 * Borrado lógico, como todo en Bills: una comanda vieja puede seguir
 * apuntándola y tiene que poder leerse.
 */
export async function removeModifier(modifierId: string): Promise<OpcionesMutationResult> {
  const { session } = await requireModule(AppModule.TABLES);

  try {
    await borrarModificador(modifierId, session.user.businessId, session.user.id);
    return { ok: true };
  } catch (error) {
    await logError("modifiers.removeOption", error, {
      businessId: session.user.businessId,
      userId: session.user.id,
      context: { modifierId },
    });
    return { ok: false, error: "No pudimos sacar la opción. Intentá de nuevo." };
  }
}
