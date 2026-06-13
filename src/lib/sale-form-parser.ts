import { PaymentMethod } from "@/generated/prisma/client";

export type ParsedSaleItem = {
  serviceId: string;
  quantity: number;
};

export type ParsedSaleItemsResult =
  | { error: null; items: ParsedSaleItem[] }
  | { error: string; items: [] };

export function parseRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

export function parsePaymentMethod(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const methods = Object.values(PaymentMethod);
  return methods.includes(value as PaymentMethod) ? (value as PaymentMethod) : null;
}

export function parseSaleItemsFromFormData(formData: FormData): ParsedSaleItemsResult {
  const serviceIds = formData.getAll("serviceId[]");
  const quantities = formData.getAll("quantity[]");
  const rowCount = Math.max(serviceIds.length, quantities.length);
  const items: ParsedSaleItem[] = [];

  for (let index = 0; index < rowCount; index += 1) {
    const serviceId = parseOptionalString(serviceIds[index]);
    const quantityValue = parseOptionalString(quantities[index]);

    if (!serviceId && !quantityValue) {
      continue;
    }

    if (!serviceId || !quantityValue) {
      return {
        error: "Completá servicio y cantidad en cada fila agregada.",
        items: [],
      };
    }

    const quantity = parseQuantity(quantityValue);

    if (!quantity) {
      return {
        error: "La cantidad de cada servicio tiene que ser un número entero mayor a cero.",
        items: [],
      };
    }

    items.push({ serviceId, quantity });
  }

  if (items.length === 0) {
    return {
      error: "Agregá al menos un servicio para registrar la venta.",
      items: [],
    };
  }

  return { error: null, items };
}

function parseOptionalString(value: FormDataEntryValue | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function parseQuantity(value: string) {
  const quantity = Number(value);
  return Number.isInteger(quantity) && quantity > 0 ? quantity : null;
}
