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
import { findMesasParaCobrar, resumenDeMesasAbiertas } from "@/modules/tables/tables.repository";
import { getOrderForCheckout } from "@/modules/tables/orders.use-cases";
import { PosCheckoutClient } from "@/components/pos-checkout-client";
import type { PosBranch, PosCustomer } from "@/components/pos-checkout";

type NewSalePageProps = {
  searchParams: Promise<{
    branchId?: string | string[];
    appointment?: string | string[];
    quote?: string | string[];
    orderId?: string | string[];
  }>;
};

export default async function NewSalePage({ searchParams }: NewSalePageProps) {
  const { business, session } = await requireBusinessContext();

  const params = await searchParams;
  const rawBranchId = Array.isArray(params.branchId) ? params.branchId[0] : params.branchId;
  const rawAppointment = Array.isArray(params.appointment) ? params.appointment[0] : params.appointment;
  const rawQuote = Array.isArray(params.quote) ? params.quote[0] : params.quote;
  const rawOrderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;

  const usesCustomers = business.has(AppModule.CUSTOMERS);
  const usesStock = business.has(AppModule.STOCK);
  // Solo el rubro con salón elige mesa al cobrar. Una barbería no tiene por qué
  // ver un paso preguntando dónde se sentó el cliente.
  const usesTables = business.has(AppModule.TABLES);

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

  // Cobro de una comanda: viene del botón "Cobrar" del salón. El pedido entra
  // cargado, la mesa ya está dicha (sin pasos de más) y, al confirmar, la
  // comanda queda pagada y la mesa se libera (ver submitSale).
  const order =
    rawOrderId && usesTables ? await getOrderForCheckout(business.id, rawOrderId).catch(() => null) : null;

  const initialBranchId =
    order?.branchId ??
    quote?.branchId ??
    appointment?.branchId ??
    (rawBranchId && rawBranchId.length > 0 ? rawBranchId : undefined);

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
  const [stockLevels, customers, mesasPorSucursal, abiertasPorSucursal] = await Promise.all([
    usesStock ? findStockLevelsForBranches(branches.map((branch) => branch.id)) : new Map<string, number>(),
    usesCustomers ? getCustomersForSale(business.id) : Promise.resolve([]),
    usesTables
      ? Promise.all(
          branches.map(async (branch) => [branch.id, await findMesasParaCobrar(business.id, branch.id)] as const),
        ).then((pares) => new Map(pares))
      : new Map<string, { id: string; name: string; sector: { name: string } | null }[]>(),
    // Cuánta plata quedó sentada en el salón. Es lo que convierte el atajo en un
    // aviso: sin el número hay que ir a mirar para saber si hay algo sin cerrar.
    usesTables
      ? Promise.all(
          branches.map(async (branch) => [branch.id, await resumenDeMesasAbiertas(business.id, branch.id)] as const),
        ).then((pares) => new Map(pares))
      : new Map<string, { mesas: number; total: number }>(),
  ]);

  const posBranches: PosBranch[] = branches.map((branch) => ({
    id: branch.id,
    name: branch.name,
    staffs: branch.users.map((staff) => ({ id: staff.id, name: staff.name })),
    tables: (mesasPorSucursal.get(branch.id) ?? []).map((mesa) => ({
      id: mesa.id,
      name: mesa.name,
      sector: mesa.sector?.name ?? null,
    })),
    openTables: abiertasPorSucursal.get(branch.id) ?? { mesas: 0, total: 0 },
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
      categoryName: productPrice.product.category?.name ?? null,
      categoryColor: productPrice.product.category?.color ?? null,
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
    <PosCheckoutClient
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
      order={
        order
          ? { id: order.id, tableId: order.tableId, tableName: order.tableName, waiterName: order.waiterName, items: order.items }
          : null
      }
      features={verticalFeatures(business.vertical)}
      salesRank={Object.fromEntries(salesRank)}
      usesTables={usesTables}
      paymentOptions={paymentOptions}
      sellsAsStaffId={currentUser?.sellsAsId ?? null}
      staffIcon={verticalPreset(business.vertical).staffIcon}
    />
  );
}
