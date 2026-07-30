import Afip from "@afipsdk/afip.js";

import { encryptSecret } from "@/lib/crypto";
import { isBusinessFiscallyConfigured } from "@/lib/invoice";

import { BusinessError, BusinessErrorCode } from "./business.errors";
import { findBusinessFiscalData, saveBusinessCertificate } from "./business.repository";

export type RequestProductionCertificateInput = {
  businessId: string;
  claveFiscalUsername: string;
  claveFiscalPassword: string;
};

/**
 * Genera y autoriza el certificado de producción AFIP/ARCA del negocio. Usa
 * la Clave Fiscal SOLO en esta llamada — nunca se persiste ni se loguea. El
 * certificado/clave resultante se guardan cifrados (ver src/lib/crypto.ts).
 */
export async function requestProductionCertificate(input: RequestProductionCertificateInput) {
  const business = await findBusinessFiscalData(input.businessId);

  if (!business || !isBusinessFiscallyConfigured(business)) {
    throw new BusinessError(BusinessErrorCode.FISCAL_DATA_INCOMPLETE);
  }

  const accessToken = process.env.AFIPSDK_ACCESS_TOKEN;
  if (!accessToken) {
    throw new BusinessError(BusinessErrorCode.AFIP_TOKEN_MISSING);
  }

  const alias = `staffbills-${business.id}`.slice(0, 40);
  const afip = new Afip({
    CUIT: Number(business.cuit),
    access_token: accessToken,
    production: true,
  });

  // CreateCert/CreateWSAuth automatizan el trámite manual de AFIP/ARCA (generar
  // certificado + autorizarlo para el web product "wsfe"). Están marcados
  // deprecated a favor de CreateAutomation en el SDK, pero son los únicos con
  // forma confirmada.
  const result = await afip.CreateCert(input.claveFiscalUsername, input.claveFiscalPassword, alias);
  const cert: unknown = result?.cert;
  const key: unknown = result?.key;
  if (typeof cert !== "string" || !cert || typeof key !== "string" || !key) {
    throw new Error("AfipSDK no devolvió el certificado esperado");
  }

  await afip.CreateWSAuth(input.claveFiscalUsername, input.claveFiscalPassword, alias, "wsfe");

  await saveBusinessCertificate({
    businessId: input.businessId,
    cert: encryptSecret(cert),
    key: encryptSecret(key),
    alias,
  });
}
