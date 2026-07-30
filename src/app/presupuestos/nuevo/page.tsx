import { AppShell, PageHeader } from "@/components/app-shell";
import { SectionCard } from "@/components/manager-ui";
import { QuoteBuilder, type QuoteBranch } from "@/components/quote-builder";
import { AppModule } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { getCustomersForSale } from "@/modules/customers/customer.use-cases";
import { defaultValidUntil } from "@/modules/quotes/quote.logic";
import { getSaleEntryBranches } from "@/modules/sales/get-sale-entry-options.use-case";

export default async function NuevoPresupuestoPage() {
  const { business } = await requireModule(AppModule.QUOTES);

  const [branches, customers] = await Promise.all([
    getSaleEntryBranches(business.id),
    business.has(AppModule.CUSTOMERS) ? getCustomersForSale(business.id) : Promise.resolve([]),
  ]);

  const quoteBranches: QuoteBranch[] = branches.map((branch) => ({
    id: branch.id,
    name: branch.name,
    products: branch.productPrices.map((productPrice) => ({
      id: productPrice.productId,
      name: productPrice.product.name,
      price: productPrice.price,
      unit: productPrice.product.unit,
    })),
  }));

  return (
    <AppShell maxWidth="lg">
      <PageHeader
        eyebrow="Bills"
        title="Nuevo presupuesto"
        description="Cotizá con el precio de hoy y una fecha de vencimiento. Después se convierte en venta con un toque."
      />

      <SectionCard title="Renglones" description="Podés elegir del catálogo o escribir a mano (mano de obra, flete).">
        <QuoteBuilder
          branches={quoteBranches}
          customers={customers.map((customer) => ({ id: customer.id, name: customer.name, phone: customer.phone }))}
          defaultValidUntil={toISODate(defaultValidUntil(new Date()))}
        />
      </SectionCard>
    </AppShell>
  );
}

function toISODate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
