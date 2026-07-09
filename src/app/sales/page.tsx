import { requireAdminSession } from "@/lib/auth";
import { getRecentSales } from "@/modules/sales/get-recent-sales.use-case";
import { toSalesListSale } from "@/modules/sales/recent-sales-view";
import { SalesList } from "@/components/sales-list";
import { loadMoreSalesAction } from "@/app/sales/actions";
import { Plus } from "@/components/icons";
import Link from "next/link";

export default async function SalesPage() {
  const session = await requireAdminSession();

  const { sales, nextCursor } = await getRecentSales(session.user.businessId, 20);
  const viewSales = sales.map(toSalesListSale);

  return (
    <main className="mx-auto min-h-screen w-full min-w-0 max-w-[560px] overflow-x-clip bg-[#f6f7fb] px-4 pb-28 pt-6 text-slate-950 lg:max-w-[1080px] lg:px-8">
      <header className="flex items-center justify-between gap-4 duration-500 animate-in fade-in slide-in-from-top-2">
        <div>
          <p className="text-sm font-medium text-slate-500">Historial</p>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight text-slate-950">Ventas</h1>
        </div>
      </header>

      <SalesList sales={viewSales} initialCursor={nextCursor} loadMore={loadMoreSalesAction} />

      <Link
        aria-label="Nueva venta"
        className="fixed bottom-[96px] right-4 z-40 flex size-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 transition hover:scale-105 active:scale-95 md:bottom-8 md:right-8"
        href="/sales/new"
      >
        <Plus className="size-6" />
      </Link>
    </main>
  );
}
