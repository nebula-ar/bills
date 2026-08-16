import { ProductChangeField } from "@/generated/prisma/enums";

/**
 * Qué cambió entre el producto guardado y lo que se está por guardar.
 *
 * Vive acá y no en el use-case porque la pregunta "¿esto es un cambio?" tiene
 * más filo del que parece: `undefined` significa "no vino en el formulario" y
 * `null` significa "lo borraron", y confundirlos escribe historial de cosas que
 * nadie tocó. Con tests, una vez.
 */

export type CampoAuditable = {
  field: ProductChangeField;
  previous: string | null;
  next: string | null;
};

/**
 * Un valor a texto para el historial. Guarda el valor CRUDO: el entero de la
 * plata, no "$ 9.520". Formatear al guardar congelaría el formato de hoy y
 * dentro de un año el historial mostraría una moneda que ya no se usa.
 */
function aTexto(valor: string | number | boolean | null | undefined): string | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "boolean") return valor ? "true" : "false";
  const texto = String(valor).trim();
  return texto.length > 0 ? texto : null;
}

/**
 * Compara un campo. Devuelve null cuando no hay nada que anotar.
 *
 * `siguiente === undefined` NO es un cambio: el campo no vino en el formulario
 * —está en otra pestaña, o el rubro no lo usa— y anotarlo como "lo borraron"
 * llenaría el historial de borrados que nunca pasaron. Es el caso que más
 * fácil se cuela.
 */
export function compararCampo(
  field: ProductChangeField,
  anterior: string | number | boolean | null | undefined,
  siguiente: string | number | boolean | null | undefined,
): CampoAuditable | null {
  if (siguiente === undefined) return null;

  const previous = aTexto(anterior);
  const next = aTexto(siguiente);

  if (previous === next) return null;

  return { field, previous, next };
}

/** Todos los cambios de una edición, ya filtrados. */
export function diffDeProducto(input: {
  anterior: Record<string, string | number | boolean | null | undefined>;
  siguiente: Record<string, string | number | boolean | null | undefined>;
  campos: { clave: string; field: ProductChangeField }[];
}): CampoAuditable[] {
  return input.campos
    .map(({ clave, field }) => compararCampo(field, input.anterior[clave], input.siguiente[clave]))
    .filter((cambio): cambio is CampoAuditable => cambio !== null);
}

/** Los campos del producto global que se auditan, con su clave en el input. */
export const CAMPOS_DE_PRODUCTO = [
  { clave: "name", field: ProductChangeField.NAME },
  { clave: "cost", field: ProductChangeField.COST },
  { clave: "description", field: ProductChangeField.DESCRIPTION },
  { clave: "sku", field: ProductChangeField.SKU },
  { clave: "barcode", field: ProductChangeField.BARCODE },
  { clave: "minStock", field: ProductChangeField.MIN_STOCK },
  { clave: "idealStock", field: ProductChangeField.IDEAL_STOCK },
  { clave: "categoryId", field: ProductChangeField.CATEGORY },
] as const;
