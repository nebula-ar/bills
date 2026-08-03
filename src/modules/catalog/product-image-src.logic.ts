// De dónde sale la foto de un producto.
//
// Hay dos orígenes y no son intercambiables:
//
//   1. La foto que subió el negocio. Vive en `ProductImage` (bytes en la base),
//      es privada y se sirve por una ruta que valida el negocio. Cambia, así que
//      la URL lleva versión.
//   2. La foto del catálogo de rubro. Es un archivo estático compartido: las
//      verdulerías leen todas la misma `banana.webp`. No cambia nunca y no es de
//      nadie en particular.
//
// La foto propia gana siempre: si el dueño se tomó el trabajo de fotografiar SU
// tomate, es porque el genérico no le servía.
//
// Antes esta decisión estaba repetida en cada pantalla como un template string
// suelto. Repetida quiere decir que cada pantalla podía equivocarse distinto.

// Base de las imágenes del catálogo. Por defecto salen de `public/`, que en
// Vercel ya se sirve desde el CDN edge: no toca el servidor y se cachea
// inmutable en todo el mundo.
//
// Se puede apuntar a otro CDN (un bucket de Supabase, por ejemplo) con
// NEXT_PUBLIC_CATALOG_CDN. Es un cambio de configuración, no de runtime: no hay
// fallback por request, ni `onError` en cada `<img>`, ni doble pedido cuando el
// bucket no responde. Se elige una vez, en el build.
export const CATALOG_IMAGE_BASE = process.env.NEXT_PUBLIC_CATALOG_CDN ?? "/catalog/produce";

export type ProductImageRef = {
  id: string;
  // Marca de tiempo de la foto propia (`imageUpdatedAt.getTime()`), o `null` si
  // el negocio no subió ninguna. Es un número y no un `Date` porque esto lo
  // consumen componentes cliente, y el server ya lo aplana al armar la vista.
  imageVersion: number | null;
  // Qué producto del catálogo de rubro es. `null` = uno cargado a mano.
  catalogSlug: string | null;
};

export type ProductImageOptions = {
  // Token de la página pública. Sin sesión, la foto propia se sirve por la ruta
  // que revalida el negocio contra el token.
  publicToken?: string;
};

export function productImageSrc(product: ProductImageRef, options: ProductImageOptions = {}): string | null {
  if (product.imageVersion) {
    return options.publicToken
      ? `/api/public/${options.publicToken}/products/${product.id}/image?v=${product.imageVersion}`
      : `/api/products/${product.id}/image?v=${product.imageVersion}`;
  }

  // Sin versión a propósito: el archivo del catálogo es inmutable y lo comparten
  // todos los negocios. Que el navegador lo cachee para siempre es el objetivo,
  // no un descuido.
  if (product.catalogSlug) {
    return `${CATALOG_IMAGE_BASE}/${product.catalogSlug}.webp`;
  }

  return null;
}
