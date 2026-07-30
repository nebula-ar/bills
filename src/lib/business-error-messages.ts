import { BusinessErrorCode } from "@/modules/business/business.errors";

const businessErrorMessages: Record<BusinessErrorCode, string> = {
  [BusinessErrorCode.BUSINESS_NOT_FOUND]: "No encontramos el negocio para actualizar.",
  [BusinessErrorCode.CUIT_INVALID]: "El CUIT no es válido (revisá el dígito verificador).",
  [BusinessErrorCode.FISCAL_DATA_INCOMPLETE]: "Completá el CUIT, la condición frente al IVA y el punto de venta antes de generar el certificado.",
  [BusinessErrorCode.AFIP_TOKEN_MISSING]: "Falta configurar el acceso a AFIP/ARCA (AFIPSDK_ACCESS_TOKEN). Contactá a soporte.",
};

export function getBusinessErrorMessage(code: BusinessErrorCode) {
  return businessErrorMessages[code];
}
