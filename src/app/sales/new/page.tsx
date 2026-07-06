import { PaymentMethod } from "@/generated/prisma/client";
import { requireAdminSession } from "@/lib/auth";
import { getSaleEntryBranches } from "@/modules/sales/get-sale-entry-options.use-case";
import { PosCheckout, type PosBranch } from "@/components/pos-checkout";

const paymentMethodLabels: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: "Efectivo",
  [PaymentMethod.DEBIT_CARD]: "Débito",
  [PaymentMethod.CREDIT_CARD]: "Crédito",
  [PaymentMethod.TRANSFER]: "Transferencia",
  [PaymentMethod.QR]: "QR",
  [PaymentMethod.OTHER]: "Otro",
};

export default async function NewSalePage() {
  await requireAdminSession();

  const branches = await getSaleEntryBranches();
  const posBranches: PosBranch[] = branches.map((branch) => ({
    id: branch.id,
    name: branch.name,
    businessName: branch.business.name,
    barbers: branch.users.map((barber) => ({ id: barber.id, name: barber.name })),
    services: branch.servicePrices.map((servicePrice) => ({
      serviceId: servicePrice.serviceId,
      name: servicePrice.service.name,
      price: servicePrice.price,
    })),
  }));

  const paymentOptions = Object.values(PaymentMethod).map((method) => ({
    value: method,
    label: paymentMethodLabels[method],
  }));

  return <PosCheckout branches={posBranches} paymentOptions={paymentOptions} />;
}
