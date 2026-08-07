// Qué se carga cuando el negocio toca "cargar el catálogo del rubro".
//
// Para casi todos los rubros es la muestra corta que vive en el preset: seis
// productos de ejemplo para que la pantalla no arranque vacía.
//
// La verdulería es distinta. Ahí el catálogo REAL se puede saber de antemano
// —toda verdulería vende las mismas 120 cosas— así que se carga entero, con la
// unidad de venta correcta y el slug que le da la foto compartida. El dueño no
// tipea 120 nombres ni fotografía una banana.
//
// POR QUÉ ACÁ Y NO EN vertical.ts
// `vertical.ts` lo importan componentes cliente (etiquetas, features), así que
// el array de 122 ítems terminaría viajando al navegador para nada: solo se usa
// del lado del servidor, al sembrar y al contar cuántos se van a cargar.

import { ProductKind, Vertical } from "@/generated/prisma/enums";
import { type SeedProduct, verticalPreset } from "@/lib/vertical";

import { PRODUCE_CATALOG } from "./produce-catalog.data";
import { PRODUCE_REFERENCE_PRICES } from "./produce-prices";

// Si un producto se quedara sin precio de referencia, entra al catálogo sin
// precio en vez de entrar con cero: `seedPresetCatalog` lee este centinela y NO
// crea la fila de `BranchProductPrice`. Una fila en cero se vería como
// "Disponible · $ 0" y se podría vender a cero pesos; sin fila, el producto
// queda esperando precio y fuera de la pantalla de venta, que es como el resto
// de la app representa "sin precio".
const NO_PRICE = 0;

// Lo que el negocio eligió en la pantalla de revisión: qué productos entran,
// con qué precio y con cuánta existencia.
export type SeedSelection = { name: string; price?: number; stock?: number };

function positiveInteger(value: number | undefined) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

// Cruza lo elegido contra el catálogo del rubro.
//
// El producto se RECONSTRUYE desde el catálogo del servidor: nombre, categoría,
// unidad y si es mercadería salen de acá, y del cliente se toman solo el precio
// y la existencia. Un nombre que no está en el catálogo se ignora. Si no fuera
// así, cualquiera podría mandar un producto inventado a la carga masiva, que
// escribe directo en la base salteándose los casos de uso de alta.
//
// Sin selección entra el catálogo entero, que es el atajo de "traer todo".
export function applySeedSelection(catalog: SeedProduct[], selection?: SeedSelection[]): SeedProduct[] {
  if (!selection) return catalog;

  const elegido = new Map(selection.map((item) => [item.name, item]));

  return catalog.flatMap((item) => {
    const pedido = elegido.get(item.name);

    if (!pedido) return [];

    return [
      {
        ...item,
        price: positiveInteger(pedido.price) ?? item.price,
        // Existencia declarada por quien la contó. Sin número no se asienta
        // nada: un movimiento INITIAL dice que entró mercadería, y si nadie la
        // contó, no entró.
        stock: positiveInteger(pedido.stock),
      },
    ];
  });
}

export function presetCatalogFor(vertical: Vertical): SeedProduct[] {
  if (vertical !== Vertical.GROCERY) {
    return verticalPreset(vertical).catalog;
  }

  return PRODUCE_CATALOG.map((item) => ({
    name: item.name,
    // De referencia, para que se pueda vender el mismo día. El botón dice
    // "Cargar y revisar precios" y el segundo verbo es parte del trato.
    price: PRODUCE_REFERENCE_PRICES[item.slug] ?? NO_PRICE,
    category: item.category,
    // Sin GOOD el sembrado los crea como servicio y no descuentan existencia:
    // se venderían tomates sin que el stock baje nunca.
    kind: ProductKind.GOOD,
    unit: item.unit,
    catalogSlug: item.slug,
  }));
}
