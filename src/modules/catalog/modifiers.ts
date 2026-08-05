/**
 * Opciones de producto: "con leche descremada", "sin azúcar", "extra jamón".
 *
 * Lógica pura, sin base ni React. La plata va en pesos enteros como en todo
 * Bills (ver src/lib/money.ts), así que acá no hay redondeo que arrastre
 * diferencias: la suma de los renglones cierra con el total por construcción.
 */

export type ModificadorLike = { priceDelta: number };

export type Modificador = {
  id: string;
  name: string;
  priceDelta: number;
};

export type GrupoConModificadores = {
  id: string;
  name: string;
  /** Hay que elegir al menos uno. */
  required: boolean;
  minSelect: number;
  /** 1 = elegir una; >1 = varias. */
  maxSelect: number;
  modifiers: Modificador[];
};

/** Suma de los ajustes de precio elegidos. */
export function modifiersDelta(mods: ModificadorLike[]): number {
  return mods.reduce((total, m) => total + m.priceDelta, 0);
}

/**
 * Precio unitario con las opciones aplicadas.
 *
 * Con piso en cero, y no es defensivo de más: sin él, un modificador de ajuste
 * negativo repetido dejaba la línea en negativo y arrastraba el total de la
 * comanda hasta cero. Es el agujero que apareció en Migas con el link público
 * del QR, donde el pedido lo arma el cliente.
 */
export function effectiveUnitPrice(base: number, mods: ModificadorLike[]): number {
  return Math.max(0, base + modifiersDelta(mods));
}

/**
 * Valida una selección completa contra los grupos DEL PRODUCTO. Devuelve el
 * motivo del rechazo, o null si está bien.
 *
 * Es una sola función a propósito. La comprobación que importa —que cada
 * modificador pertenezca a un grupo asignado a ESTE producto— era en Migas un
 * chequeo suelto en la server action, y así es como se olvida: con el link del
 * QR en la mano, un cliente podía colgarle a su café un "sin jamón −$500" de
 * otro producto, repetirlo, y dejar su cuenta en cero.
 */
export function validarSeleccion(
  grupos: GrupoConModificadores[],
  seleccionados: string[],
): string | null {
  const propios = new Map<string, GrupoConModificadores>();
  for (const grupo of grupos) {
    for (const mod of grupo.modifiers) propios.set(mod.id, grupo);
  }

  // 1. Pertenencia. Primero, porque lo demás no tiene sentido sin esto.
  for (const id of seleccionados) {
    if (!propios.has(id)) {
      return "Una de las opciones elegidas no corresponde a este producto";
    }
  }

  // 2. Cuántas de cada grupo. Se cuenta la selección tal cual llega, con
  // repetidos incluidos: mandar el mismo tres veces es la forma obvia de
  // intentar multiplicar un ajuste.
  const porGrupo = new Map<string, number>();
  for (const id of seleccionados) {
    const grupo = propios.get(id)!;
    porGrupo.set(grupo.id, (porGrupo.get(grupo.id) ?? 0) + 1);
  }

  for (const grupo of grupos) {
    const elegidas = porGrupo.get(grupo.id) ?? 0;
    const minimo = grupo.required ? Math.max(grupo.minSelect, 1) : grupo.minSelect;

    if (elegidas < minimo) {
      return `Falta elegir en "${grupo.name}"`;
    }
    if (grupo.maxSelect > 0 && elegidas > grupo.maxSelect) {
      return `Demasiadas opciones en "${grupo.name}"`;
    }
  }

  return null;
}

/**
 * Valida la configuración de un grupo al crearlo o editarlo. Devuelve el
 * mensaje de error, o null si es válida.
 */
export function validateGroupConfig(cfg: {
  name: string;
  required?: boolean;
  minSelect?: number;
  maxSelect?: number;
}): string | null {
  if (!cfg.name.trim()) return "El nombre es obligatorio";

  const min = cfg.minSelect ?? 0;
  const max = cfg.maxSelect ?? 1;

  if (min < 0 || max < 0) return "Los límites no pueden ser negativos";
  if (max < 1) return "El máximo tiene que ser al menos 1";
  if (min > max) return "El mínimo no puede superar al máximo";

  return null;
}

/**
 * Acomoda min/max a algo coherente.
 *
 * Un grupo marcado como obligatorio con mínimo 0 se puede saltear: la etiqueta
 * dice una cosa y la regla hace otra. Acá se resuelve a favor de la etiqueta.
 */
export function normalizeGroupSelection(cfg: {
  required: boolean;
  minSelect: number;
  maxSelect: number;
}): { minSelect: number; maxSelect: number } {
  const maxSelect = Math.max(1, Math.floor(cfg.maxSelect));
  let minSelect = Math.max(0, Math.floor(cfg.minSelect));

  if (cfg.required) minSelect = Math.max(1, minSelect);
  minSelect = Math.min(minSelect, maxSelect);

  return { minSelect, maxSelect };
}
