import { PaymentMethod } from "@/generated/prisma/client";
import { requireAdminSession } from "@/lib/auth";
import { getRecentSales } from "@/modules/sales/get-recent-sales.use-case";
import { SalesList, type SalesListSale } from "@/components/sales-list";
import { Plus } from "lucide-react";
import Link from "next/link";

const paymentMethodLabels: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: "Efectivo",
  [PaymentMethod.DEBIT_CARD]: "Débito",
  [PaymentMethod.CREDIT_CARD]: "Crédito",
  [PaymentMethod.TRANSFER]: "Transferencia",
  [PaymentMethod.QR]: "QR",
  [PaymentMethod.OTHER]: "Otro",
};

const timeFormatter = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" });
const dayFormatter = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

type SalesPageProps = {
  searchParams: Promise<{
    status?: string | string[];
    message?: string | string[];
  }>;
};

export default async function SalesPage({ searchParams }: SalesPageProps) {
  await requireAdminSession();

  const params = await searchParams;
  const flash = getFlashMessage(params.status, params.message);
  const sales = await getRecentSales(20);

  const viewSales: SalesListSale[] = sales.map((sale) => ({
    id: sale.id,
    timeLabel: timeFormatter.format(sale.soldAt),
    dateLabel: dayFormatter.format(sale.soldAt),
    barberName: sale.barberName,
    branchName: sale.branchName,
    total: sale.total,
    status: sale.status,
    itemSummary: sale.items.map((item) => `${item.description} x${item.quantity}`).join(", "),
    paymentSummary: summarizePayments(sale.payments),
    items: sale.items,
    payments: sale.payments.map((payment) => ({
      id: payment.id,
      label: paymentMethodLabels[payment.method],
      amount: payment.amount,
    })),
  }));

  return (
    <main className="mx-auto min-h-screen w-full min-w-0 max-w-[560px] overflow-x-clip bg-[#f6f7fb] px-4 pb-28 pt-6 text-slate-950">
      <header className="flex items-center justify-between gap-4 duration-500 animate-in fade-in slide-in-from-top-2">
        <div>
          <p className="text-sm font-medium text-slate-500">Historial</p>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight text-slate-950">Ventas</h1>
        </div>
        <Link
          className="flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-black text-white shadow-sm shadow-blue-600/25 transition active:scale-95"
          href="/sales/new"
        >
          <Plus className="size-4" />
          Nueva venta
        </Link>
      </header>

      {flash ? (
        <div
          className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold duration-300 animate-in fade-in ${
            flash.status === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {flash.message}
        </div>
      ) : null}

      <SalesList sales={viewSales} />
    </main>
  );
}

function summarizePayments(payments: { method: PaymentMethod }[]) {
  if (payments.length === 0) return "Sin pago";
  const methods = new Set(payments.map((payment) => payment.method));
  if (methods.size > 1) return "Mixto";
  return paymentMethodLabels[payments[0].method];
}

function getFlashMessage(status: string | string[] | undefined, message: string | string[] | undefined) {
  const singleStatus = getSingleParam(status);
  const singleMessage = getSingleParam(message);

  if ((singleStatus === "success" || singleStatus === "error") && singleMessage) {
    return { status: singleStatus, message: singleMessage };
  }

  return null;
}

function getSingleParam(value: string | string[] | undefined) {
  const single = Array.isArray(value) ? value[0] : value;
  return single === "" ? undefined : single;
}
