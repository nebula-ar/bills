import { ProductErrorCode, type ProductErrorCode as ProductErrorCodeType } from "@/modules/catalog/product.errors";

const productErrorMessages: Record<ProductErrorCodeType, string> = {
  [ProductErrorCode.BRANCH_NOT_FOUND]: "No encontramos la sucursal seleccionada.",
  [ProductErrorCode.PRODUCT_NOT_FOUND]: "No encontramos el ítem seleccionado.",
  [ProductErrorCode.PRODUCT_PRICE_NOT_FOUND]: "Ese ítem no está configurado en esta sucursal.",
  [ProductErrorCode.INVALID_PRODUCT_NAME]: "Ingresá un nombre válido.",
  [ProductErrorCode.INVALID_PRICE]: "Ingresá un precio válido en pesos.",
  [ProductErrorCode.INVALID_COST]: "Ingresá un costo válido en pesos.",
  [ProductErrorCode.INVALID_MIN_STOCK]: "Ingresá un stock mínimo válido.",
  [ProductErrorCode.DUPLICATE_CODE]: "Ya hay otro ítem con ese código o SKU.",
  [ProductErrorCode.INVALID_IMAGE]: "No pudimos leer esa imagen. Probá con otra foto.",
  [ProductErrorCode.INVALID_IMAGE_TYPE]: "Ese formato de imagen no sirve. Usá una foto JPG, PNG o WebP.",
  [ProductErrorCode.IMAGE_TOO_LARGE]: "La foto es demasiado pesada. Sacale una más chica.",
  [ProductErrorCode.NO_VARIANTS]: "Cargá al menos un talle o color.",
  [ProductErrorCode.TOO_MANY_VARIANTS]: "Son demasiadas combinaciones (máximo 100). Cargalas en tandas.",
};

export function getProductErrorMessage(code: ProductErrorCodeType) {
  return productErrorMessages[code];
}
