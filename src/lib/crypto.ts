// Cifrado en reposo para secretos sensibles (certificado/clave privada AFIP
// de cada Business). Sin KMS/secrets manager — se cifra a nivel de aplicación
// con AES-256-GCM y una clave simétrica en variable de entorno, mismo
// espíritu que STAFF_SESSION_SECRET.

import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.CERT_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("Falta configurar CERT_ENCRYPTION_KEY (generá uno con: openssl rand -base64 32).");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("CERT_ENCRYPTION_KEY debe ser una clave de 32 bytes en base64.");
  }
  return key;
}

/** Cifra un secreto. Formato de salida: "iv.authTag.ciphertext" en base64. */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, encrypted].map((b) => b.toString("base64")).join(".");
}

/** Descifra un secreto cifrado con encryptSecret. Tira si la clave no coincide o el dato fue alterado. */
export function decryptSecret(ciphertext: string): string {
  const [ivB64, authTagB64, dataB64] = ciphertext.split(".");
  if (!ivB64 || !authTagB64 || !dataB64) {
    throw new Error("Formato de secreto cifrado inválido.");
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

/** Descifra el certificado AFIP de un Business, si tiene uno. */
export function decryptBusinessCertificate(business: {
  afipCertEncrypted: string | null;
  afipKeyEncrypted: string | null;
}): { cert: string; key: string } | undefined {
  if (!business.afipCertEncrypted || !business.afipKeyEncrypted) return undefined;
  return {
    cert: decryptSecret(business.afipCertEncrypted),
    key: decryptSecret(business.afipKeyEncrypted),
  };
}
