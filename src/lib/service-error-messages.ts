import { ServiceErrorCode, type ServiceErrorCode as ServiceErrorCodeType } from "@/modules/services/service.errors";

const serviceErrorMessages: Record<ServiceErrorCodeType, string> = {
  [ServiceErrorCode.BRANCH_NOT_FOUND]: "No encontramos la sucursal seleccionada.",
  [ServiceErrorCode.SERVICE_NOT_FOUND]: "No encontramos el servicio seleccionado.",
  [ServiceErrorCode.SERVICE_PRICE_NOT_FOUND]: "No encontramos el servicio configurado para esta sucursal.",
  [ServiceErrorCode.INVALID_SERVICE_NAME]: "Ingresá un nombre de servicio válido.",
  [ServiceErrorCode.INVALID_PRICE]: "Ingresá un precio válido en pesos.",
};

export function getServiceErrorMessage(code: ServiceErrorCodeType) {
  return serviceErrorMessages[code];
}
