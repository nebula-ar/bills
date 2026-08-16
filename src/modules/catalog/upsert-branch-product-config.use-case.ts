import { ProductError, ProductErrorCode } from "./product.errors";
import {
  findBranchProductConfig,
  findProductManagementBranchById,
  findProductManagementProductById,
  recordProductChanges,
  upsertBranchProductConfig,
} from "./product.repository";
import { compararCampo } from "./product-change.logic";
import { ProductChangeField } from "@/generated/prisma/enums";

export type UpsertBranchProductConfigInput = {
  businessId: string;
  branchId: string;
  productId: string;
  price: number;
  active: boolean;
  // Quién guarda. Opcional: el historial no inventa autor cuando no lo hay.
  changedById?: string | null;
};

export async function upsertBranchProductConfiguration(input: UpsertBranchProductConfigInput) {
  if (!Number.isInteger(input.price) || input.price <= 0) {
    throw new ProductError(ProductErrorCode.INVALID_PRICE);
  }

  const [branch, product] = await Promise.all([
    findProductManagementBranchById(input.branchId, input.businessId),
    findProductManagementProductById(input.productId, input.businessId),
  ]);

  if (!branch) {
    throw new ProductError(ProductErrorCode.BRANCH_NOT_FOUND);
  }

  if (!product || product.businessId !== branch.businessId) {
    throw new ProductError(ProductErrorCode.PRODUCT_NOT_FOUND);
  }

  // El "antes" se lee antes de escribir: después del upsert ya no existe.
  // Precio y disponibilidad son POR SUCURSAL, así que el historial guarda cuál:
  // "bajó a 9.520" sin decir dónde no se puede verificar contra nada.
  const previo = await findBranchProductConfig(branch.id, product.id);

  const resultado = await upsertBranchProductConfig({
    branchId: branch.id,
    productId: product.id,
    price: input.price,
    active: input.active,
  });

  // Después del upsert: si el historial falla, la configuración igual quedó
  // guardada. Perder el precio por no poder anotarlo sería peor.
  const cambios = [
    compararCampo(ProductChangeField.PRICE, previo?.price ?? null, input.price),
    compararCampo(ProductChangeField.AVAILABILITY, previo?.active ?? null, input.active),
  ].filter((cambio) => cambio !== null);

  await recordProductChanges({
    productId: product.id,
    businessId: input.businessId,
    branchId: branch.id,
    changedById: input.changedById,
    cambios,
  });

  return resultado;
}
