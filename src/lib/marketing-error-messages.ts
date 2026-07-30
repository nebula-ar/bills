import { MarketingErrorCode } from "@/modules/marketing/marketing.errors";

const marketingErrorMessages: Record<MarketingErrorCode, string> = {
  [MarketingErrorCode.BUSINESS_NOT_FOUND]: "No encontramos el negocio.",
  [MarketingErrorCode.INVALID_URL]: "El link tiene que empezar con http:// o https://.",
  [MarketingErrorCode.INVALID_POINTS_RULE]: "Los valores de puntos tienen que ser números mayores a cero.",
  [MarketingErrorCode.INVALID_POINTS]: "Ingresá una cantidad de puntos válida.",
  [MarketingErrorCode.NOT_ENOUGH_POINTS]: "El cliente no tiene esa cantidad de puntos.",
  [MarketingErrorCode.LOYALTY_DISABLED]: "Configurá primero cuántos pesos suman un punto y cuánto vale cada punto.",
  [MarketingErrorCode.PAGE_NOT_FOUND]: "Esta página no está disponible.",
  [MarketingErrorCode.BOOKING_UNAVAILABLE]: "Ese horario ya está ocupado. Elegí otro.",
  [MarketingErrorCode.INVALID_BOOKING]: "Completá tu nombre, el teléfono y el horario.",
};

export function getMarketingErrorMessage(code: MarketingErrorCode) {
  return marketingErrorMessages[code];
}
