import { AppModule } from "@/generated/prisma/client";
import { requireBusinessContext } from "@/lib/business-context";
import { verticalFeatures, verticalPreset } from "@/lib/vertical";
import { paymentMethodOptions, salePaymentMethods } from "@/lib/payment-labels";
import { getCustomersForSale } from "@/modules/customers/customer.use-cases";
import { getAppointmentForCheckout } from "@/modules/appointments/appointment.use-cases";
import { getQuoteForCheckout } from "@/modules/quotes/quote.use-cases";
import { findUserWithSellsAs } from "@/modules/auth/user.repository";
import { getSaleEntryBranches } from "@/modules/sales/get-sale-entry-options.use-case";
import { findTopSellingProductIds } from "@/modules/sales/sale.repository";
import { findStockLevelsForBranches } from "@/modules/stock/stock.repository";
import { PosCheckout, type PosBranch, type PosCustomer } from "@/components/pos-checkout";

type NewSalePageProps = {
  searchParams: Promise<{ branchId?: string | string[]; appointment?: string | string[]; quote?: string | string[] }>;
};

export default async function NewSalePage({ searchParams }: NewSalePageProps) {
  const { business, session } = await requireBusinessContext();

  const params = await searchParams;
  const rawBranchId = Array.isArray(params.branchId) ? params.branchId[0] : params.branchId;
  const rawAppointment = Array.isArray(params.appointment) ? params.appointment[0] : params.appointment;
  const rawQuote = Array.isArray(params.quote) ? params.quote[0] : params.quote;

  // Cobro de un turno: el POS arranca con todo elegido y, al confirmar, la venta
  // queda enlazada al turno (ver submitSale).
  const appointment =
    rawAppointment && business.has(AppModule.APPOINTMENTS)
      ? await getAppointmentForCheckout(rawAppointment, business.id).catch(() => null)
      : null;

  // Cobro de un presupuesto: el pedido entra cargado y la cotización queda
  // marcada como convertida al confirmar.
  const quote =
    rawQuote && business.has(AppModule.QUOTES)
      ? await getQuoteForCheckout(rawQuote, business.id).catch(() => null)
      : null;

  const initialBranchId = quote?.branchId ?? appointment?.branchId ?? (rawBranchId && rawBranchId.length > 0 ? rawBranchId : undefined);

  const usesCustomers = business.has(AppModule.CUSTOMERS);
  const usesStock = business.has(AppModule.STOCK);

  const branches = await getSaleEntryBranches(business.id);

  // Si el que entró atiende, el mostrador arranca con él elegido en vez de
  // preguntar quién atiende en cada venta (ver registerBusiness: el dueño que
  // atiende tiene un gemelo empleado).
  const currentUser = await findUserWithSellsAs(session.user.id);

  // Ranking de los últimos 30 días para ordenar la grilla por lo que más sale.
  const rankFrom = new Date();
  rankFrom.setDate(rankFrom.getDate() - 30);
  const salesRank = await findTopSellingProductIds(business.id, rankFrom);

  // Existencias y clientes solo si el negocio usa esos módulos: una barbería no
  // necesita cargar nada de esto para cobrar un corte.
  const [stockLevels, customers] = await Promise.all([
    usesStock ? findStockLevelsForBranches(branches.map((branch) => branch.id)) : new Map<string, number>(),
    usesCustomers ? getCustomersForSale(business.id) : Promise.resolve([]),
  ]);

  const posBranches: PosBranch[] = branches.map((branch) => ({
    id: branch.id,
    name: branch.name,
    businessName: branch.business.name,
    staffs: branch.users.map((staff) => ({ id: staff.id, name: staff.name })),
    products: branch.productPrices.map((productPrice) => ({
      productId: productPrice.productId,
      name: productPrice.product.name,
      price: productPrice.price,
      unit: productPrice.product.unit,
      sku: productPrice.product.sku,
      barcode: productPrice.product.barcode,
      // null = no lleva control de stock, así que no se muestra existencia.
      stock: productPrice.product.trackStock
        ? stockLevels.get(`${branch.id}:${productPrice.productId}`) ?? 0
        : null,
      imageVersion: productPrice.product.imageUpdatedAt?.getTime() ?? null,
      catalogSlug: productPrice.product.catalogSlug,
      packSize: productPrice.product.packSize,
      packLabel: productPrice.product.packLabel,
      familyId: productPrice.product.familyId,
      familyName: productPrice.product.family?.name ?? null,
      variantLabel: productPrice.product.variantLabel,
    })),
  }));

  const posCustomers: PosCustomer[] = customers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    balance: customer.balance,
    creditLimit: customer.creditLimit,
  }));

  // La cuenta corriente solo aparece como forma de cobro si el módulo está
  // prendido; si no, "fiar" no significa nada en este negocio.
  const paymentOptions = paymentMethodOptions(salePaymentMethods(usesCustomers));

  return (
    <PosCheckout
      branches={posBranches}
      catalogIcon={verticalPreset(business.vertical).catalogIcon}
      catalogPlural={business.labels.catalogPlural}
      catalogSingular={business.labels.catalogSingular}
      customers={posCustomers}
      initialBranchId={initialBranchId}
      appointment={
        appointment
          ? {
              id: appointment.id,
              staffId: appointment.staffId,
              customerId: appointment.customerId,
              productId: appointment.productId,
            }
          : null
      }
      quote={quote ? { id: quote.id, customerId: quote.customerId, items: quote.items } : null}
      features={verticalFeatures(business.vertical)}
      salesRank={Object.fromEntries(salesRank)}
      paymentOptions={paymentOptions}
      sellsAsStaffId={currentUser?.sellsAsId ?? null}
      staffIcon={verticalPreset(business.vertical).staffIcon}
    />
  );
}
