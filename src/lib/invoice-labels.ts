// Import desde `enums.ts` (no `client.ts`): este archivo lo usan también
// componentes cliente, y `client.ts` arrastra al PrismaClient completo (que
// depende de `node:module`, no bundleable para el browser).
import { AfipStatus, TaxCondition } from "@/generated/prisma/enums";

export const TAX_CONDITION_LABELS: Record<TaxCondition, string> = {
  [TaxCondition.RESPONSABLE_INSCRIPTO]: "Responsable Inscripto",
  [TaxCondition.MONOTRIBUTO]: "Monotributo",
  [TaxCondition.EXENTO]: "Exento",
  [TaxCondition.CONSUMIDOR_FINAL]: "Consumidor Final",
  [TaxCondition.NO_RESPONSABLE]: "No Responsable",
};

export const AFIP_STATUS_LABELS: Record<AfipStatus, string> = {
  [AfipStatus.NOT_CONFIGURED]: "Sin configurar",
  [AfipStatus.PENDING]: "Pendiente de facturar",
  [AfipStatus.ISSUED]: "Facturada",
  [AfipStatus.FAILED]: "Facturación fallida",
};
