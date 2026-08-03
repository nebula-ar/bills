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

// Se siembra sin precio a propósito.
//
// Inventar un precio de referencia para 122 productos es peligroso: un precio
// equivocado es plata perdida en cada venta, y con la inflación de acá queda
// viejo en un mes. Mejor que el negocio los ponga y que lo que no tiene precio
// se vea que no lo tiene.
const NO_PRICE = 0;

export function presetCatalogFor(vertical: Vertical): SeedProduct[] {
  if (vertical !== Vertical.GROCERY) {
    return verticalPreset(vertical).catalog;
  }

  return PRODUCE_CATALOG.map((item) => ({
    name: item.name,
    price: NO_PRICE,
    category: item.category,
    // Sin GOOD el sembrado los crea como servicio y no descuentan existencia:
    // se venderían tomates sin que el stock baje nunca.
    kind: ProductKind.GOOD,
    unit: item.unit,
    catalogSlug: item.slug,
  }));
}
