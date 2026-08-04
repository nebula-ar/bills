import { ProductImageAiErrorCode } from "@/modules/catalog/product-image-ai.errors";

export function getProductImageAiErrorMessage(code: ProductImageAiErrorCode): string {
  switch (code) {
    case ProductImageAiErrorCode.CONFIG_MISSING:
      return "La generación con IA no está configurada todavía.";
    case ProductImageAiErrorCode.INVALID_REQUEST:
      return "Describí cómo querés que quede la imagen.";
    case ProductImageAiErrorCode.PRODUCT_NOT_FOUND:
      return "No encontramos ese producto.";
    case ProductImageAiErrorCode.SOURCE_IMAGE_REQUIRED:
      return "Primero cargá una foto para poder mejorarla.";
    case ProductImageAiErrorCode.DAILY_LIMIT_REACHED:
      return "Ya usaste las 5 generaciones de hoy. Mañana se habilitan de nuevo.";
    case ProductImageAiErrorCode.GENERATION_IN_PROGRESS:
      return "Ya hay una generación en curso para este negocio.";
    case ProductImageAiErrorCode.PROVIDER_RATE_LIMIT:
      return "Hay mucha demanda en este momento. Probá de nuevo en unos minutos.";
    case ProductImageAiErrorCode.PROVIDER_AUTH:
    case ProductImageAiErrorCode.PROVIDER_PAYMENT:
      return "La generación con IA no está disponible. Avisanos para revisarla.";
    default:
      return "No pudimos generar la imagen. Intentá de nuevo.";
  }
}
