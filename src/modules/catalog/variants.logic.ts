// Generación de variantes. Lógica pura: dado un modelo y sus ejes (talles,
// colores), produce la lista de variantes a crear.
//
// El caso real: llega un modelo de remera en 5 talles y 3 colores. Cargarlo a
// mano son 15 productos con el mismo precio y el mismo costo — nadie lo hace, y
// por eso terminan con "Remera" a secas y sin saber qué talle les queda.

export type VariantAxis = {
  // Cómo se llama el eje ("Talle", "Color"). Solo se usa para armar el nombre.
  name: string;
  values: string[];
};

export type GeneratedVariant = {
  // Etiqueta de la variante dentro de la familia: "M · Negro".
  label: string;
  // Nombre completo del producto: "Remera lisa M · Negro".
  name: string;
  // Sufijo para el SKU, derivado de los valores: "M-NEGRO".
  skuSuffix: string;
};

// Combina los ejes en todas sus combinaciones, en el orden en que se cargaron:
// el primer eje varía más lento, que es como uno lee una grilla de talles.
export function generateVariants(modelName: string, axes: VariantAxis[]): GeneratedVariant[] {
  const usable = axes
    .map((axis) => ({ ...axis, values: axis.values.map((value) => value.trim()).filter(Boolean) }))
    .filter((axis) => axis.values.length > 0);

  if (usable.length === 0) {
    return [];
  }

  const combinations = usable.reduce<string[][]>(
    (acc, axis) => acc.flatMap((combo) => axis.values.map((value) => [...combo, value])),
    [[]],
  );

  const model = modelName.trim();

  return combinations.map((values) => {
    const label = values.join(" · ");

    return {
      label,
      name: model ? `${model} ${label}` : label,
      skuSuffix: values.map(slug).join("-"),
    };
  });
}

// Cuántas variantes saldrían, sin generarlas: sirve para avisar antes de crear
// 200 productos por un descuido.
export function countVariants(axes: VariantAxis[]): number {
  return axes
    .map((axis) => axis.values.map((value) => value.trim()).filter(Boolean).length)
    .filter((count) => count > 0)
    .reduce((total, count) => total * count, 1);
}

// Parsea la carga rápida: "S, M, L, XL" o "S M L XL".
export function parseAxisValues(raw: string): string[] {
  return [...new Set(raw.split(/[,\n;]+|\s{2,}/).map((value) => value.trim()).filter(Boolean))];
}

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}
