import type { PaymentMethod, TaxCondition } from "@/generated/prisma/client";
import { logEvent } from "@/lib/logger";
import { validateTaxId } from "@/lib/tax-id";

import { CustomerError, CustomerErrorCode } from "./customer.errors";
import {
  createCustomerPayment,
  createCustomerRecord,
  findCustomerAccountEntries,
  findCustomerBalance,
  findCustomerBalances,
  findCustomerById,
  findCustomerSales,
  findCustomersForManagement,
  findCustomersForSale,
  softDeleteCustomer,
  updateCustomerRecord,
  type CustomerWriteInput,
} from "./customer.repository";

export { chargeCustomerAccount, findCustomerPaymentsByMethod, reverseCustomerCharge } from "./customer.repository";

export type CustomerListRow = {
  id: string;
  name: string;
  phone: string | null;
  taxId: string | null;
  creditLimit: number | null;
  active: boolean;
  salesCount: number;
  balance: number;
  // Se pasó del límite: hay que dejar de fiarle.
  overLimit: boolean;
};

export async function getCustomersForManagement(businessId: string): Promise<CustomerListRow[]> {
  const [customers, balances] = await Promise.all([
    findCustomersForManagement(businessId),
    findCustomerBalances(businessId),
  ]);

  return customers.map((customer) => {
    const balance = balances.get(customer.id) ?? 0;

    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      taxId: customer.taxId,
      creditLimit: customer.creditLimit,
      active: customer.active,
      salesCount: customer._count.sales,
      balance,
      overLimit: customer.creditLimit !== null && balance > customer.creditLimit,
    };
  });
}

// Clientes para el selector del POS, con su deuda ya calculada: el vendedor
// tiene que ver el saldo ANTES de fiar, no después.
export async function getCustomersForSale(businessId: string) {
  const [customers, balances] = await Promise.all([
    findCustomersForSale(businessId),
    findCustomerBalances(businessId),
  ]);

  return customers.map((customer) => ({
    ...customer,
    balance: balances.get(customer.id) ?? 0,
  }));
}

export async function getCustomerDetail(customerId: string, businessId: string) {
  const customer = await requireCustomer(customerId, businessId);

  const [balance, entries, sales] = await Promise.all([
    findCustomerBalance(customerId),
    findCustomerAccountEntries(customerId),
    findCustomerSales(customerId),
  ]);

  return { customer, balance, entries, sales };
}

export type CustomerInput = {
  businessId: string;
  name: string;
  taxId?: string | null;
  taxCondition?: TaxCondition | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  creditLimit?: number | null;
  active?: boolean;
  userId?: string | null;
};

export async function createCustomer(input: CustomerInput) {
  const data = validate(input);
  const customer = await createCustomerRecord(data);

  await logEvent("customer.create", `Cliente creado: ${data.name}`, {
    businessId: input.businessId,
    userId: input.userId ?? undefined,
    context: { customerId: customer.id },
  });

  return customer;
}

export async function updateCustomer(customerId: string, input: CustomerInput) {
  await requireCustomer(customerId, input.businessId);

  const data = validate(input);
  const customer = await updateCustomerRecord(customerId, data);

  await logEvent("customer.update", `Cliente actualizado: ${data.name}`, {
    businessId: input.businessId,
    userId: input.userId ?? undefined,
    context: { customerId },
  });

  return customer;
}

export async function deleteCustomer(customerId: string, businessId: string, userId?: string | null) {
  const customer = await requireCustomer(customerId, businessId);

  await softDeleteCustomer(customerId, userId);

  await logEvent("customer.delete", `Cliente eliminado: ${customer.name}`, {
    businessId,
    userId: userId ?? undefined,
    context: { customerId },
  });
}

// Cobro de una cuenta corriente. Entra plata de verdad, así que impacta en la
// caja de la sucursal donde se cobró (ver getAccountBalances).
export async function registerCustomerPayment(input: {
  customerId: string;
  businessId: string;
  branchId?: string | null;
  amount: number;
  method: PaymentMethod;
  note?: string | null;
  userId?: string | null;
}) {
  const customer = await requireCustomer(input.customerId, input.businessId);

  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new CustomerError(CustomerErrorCode.INVALID_AMOUNT);
  }

  const balance = await findCustomerBalance(input.customerId);

  if (balance <= 0) {
    throw new CustomerError(CustomerErrorCode.NOTHING_TO_PAY, { balance });
  }

  await createCustomerPayment({
    customerId: input.customerId,
    branchId: input.branchId ?? null,
    amount: input.amount,
    method: input.method,
    note: input.note ?? null,
    userId: input.userId,
  });

  await logEvent("customer.payment", `${customer.name} pagó $${input.amount} de su cuenta`, {
    businessId: input.businessId,
    userId: input.userId ?? undefined,
    context: { customerId: input.customerId, amount: input.amount, method: input.method, balanceBefore: balance },
  });

  return { balance: balance - input.amount };
}

// Chequeo previo a fiar: el cliente existe, está activo y la venta no lo pasa
// del límite. Se llama desde createSale antes de grabar nada.
export async function assertCanChargeToAccount(input: {
  customerId: string;
  businessId: string;
  amount: number;
}) {
  const customer = await requireCustomer(input.customerId, input.businessId);

  if (!customer.active) {
    throw new CustomerError(CustomerErrorCode.CUSTOMER_INACTIVE);
  }

  if (customer.creditLimit !== null) {
    const balance = await findCustomerBalance(input.customerId);

    if (balance + input.amount > customer.creditLimit) {
      throw new CustomerError(CustomerErrorCode.CREDIT_LIMIT_EXCEEDED, {
        balance,
        creditLimit: customer.creditLimit,
        attempted: input.amount,
      });
    }
  }

  return customer;
}

async function requireCustomer(customerId: string, businessId: string) {
  const customer = await findCustomerById(customerId, businessId);

  if (!customer) {
    throw new CustomerError(CustomerErrorCode.CUSTOMER_NOT_FOUND);
  }

  return customer;
}

function validate(input: CustomerInput): CustomerWriteInput {
  const name = input.name.trim();

  if (!name) {
    throw new CustomerError(CustomerErrorCode.INVALID_NAME);
  }

  const taxId = input.taxId?.trim() || null;

  if (taxId && !validateTaxId(taxId).valid) {
    throw new CustomerError(CustomerErrorCode.INVALID_TAX_ID);
  }

  const creditLimit = input.creditLimit ?? null;

  if (creditLimit !== null && (!Number.isInteger(creditLimit) || creditLimit < 0)) {
    throw new CustomerError(CustomerErrorCode.INVALID_CREDIT_LIMIT);
  }

  return {
    businessId: input.businessId,
    name,
    taxId,
    taxCondition: input.taxCondition ?? null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    address: input.address?.trim() || null,
    notes: input.notes?.trim() || null,
    creditLimit,
    active: input.active ?? true,
    userId: input.userId,
  };
}
