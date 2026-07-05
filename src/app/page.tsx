import { PaymentMethod } from "@/generated/prisma/client";
import { getCurrentSession, isAdminRole } from "@/lib/auth";
import { DashboardRange, parseDashboardRange } from "@/lib/dashboard-range";
import { getAdminDashboard } from "@/modules/dashboard/get-admin-dashboard.use-case";
import { PaymentBreakdownChart, SalesByBranchChart } from "@/components/admin-dashboard-charts";
import { AnimatedMoney } from "@/components/animated-number";
import { MobileDashboard, type MobileDashboardData } from "@/components/mobile-dashboard";
import { LogoutButton } from "@/components/logout-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BarChart3,
  CalendarDays,
  CreditCard,
  Download,
  HomeIcon,
  ReceiptText,
  Scissors,
  Store,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";

const navigationItems = [
  { href: "/", label: "Dashboard", icon: HomeIcon },
  { href: "/reports", label: "Reportes", icon: BarChart3 },
  { href: "/sales", label: "Ventas", icon: ReceiptText },
  { href: "/services", label: "Servicios", icon: Scissors },
  { href: "/branches", label: "Sucursales", icon: Store },
  { href: "/barbers", label: "Barberos", icon: Users },
];

const paymentMethodLabels: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: "Efectivo",
  [PaymentMethod.DEBIT_CARD]: "Débito",
  [PaymentMethod.CREDIT_CARD]: "Crédito",
  [PaymentMethod.TRANSFER]: "Transferencia",
  [PaymentMethod.QR]: "QR",
  [PaymentMethod.OTHER]: "Otro",
};

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
});

const dayFormatter = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const timeFormatter = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
});

const shortDateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
});

// yyyy-mm-dd en hora local, para el value de los <input type="date">.
function toISODateLocal(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// Parsea un yyyy-mm-dd como fecha local (evita el corrimiento de zona de new Date(str)).
function parseISODateLocal(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return undefined;

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatRangeDateLabel(from: Date, to: Date) {
  const sameDay = from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth() && from.getDate() === to.getDate();

  if (sameDay) {
    return dayFormatter.format(from);
  }

  return `${shortDateFormatter.format(from)} – ${shortDateFormatter.format(to)}`;
}

const kpiAccentClasses: Record<string, string> = {
  today: "bg-blue-50 text-blue-700 ring-blue-100",
  week: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  month: "bg-sky-50 text-sky-700 ring-sky-100",
  year: "bg-slate-100 text-slate-700 ring-slate-200",
};

type DashboardViewModel = Awaited<ReturnType<typeof getAdminDashboard>>;
type PaymentChartDatum = DashboardViewModel["paymentBreakdown"][number] & {
  label: string;
  percentage: number;
};

function buildMobileData(dashboard: DashboardViewModel, userName: string): MobileDashboardData {
  const kpiByKey = Object.fromEntries(dashboard.kpis.map((kpi) => [kpi.key, kpi]));
  const emptyKpi = { total: 0, saleCount: 0 };
  const { selectedRange } = dashboard;

  return {
    userName,
    range: {
      key: selectedRange.key,
      label: selectedRange.label,
      total: selectedRange.total,
      saleCount: selectedRange.saleCount,
      dateLabel: formatRangeDateLabel(selectedRange.from, selectedRange.to),
      fromValue: toISODateLocal(selectedRange.from),
      toValue: toISODateLocal(selectedRange.to),
      isToday: selectedRange.key === DashboardRange.Today,
    },
    week: kpiByKey.week ?? emptyKpi,
    month: kpiByKey.month ?? emptyKpi,
    cancelledSalesToday: dashboard.cancelledSalesToday,
    transactions: dashboard.recentSales.map((sale) => ({
      id: sale.id,
      barberName: sale.barberName,
      branchName: sale.branchName,
      itemSummary: sale.itemSummary,
      total: sale.total,
      timeLabel: timeFormatter.format(sale.soldAt),
      paymentKey:
        sale.payments.length === 0 ? "NONE" : sale.payments.length === 1 ? sale.payments[0].method : "MIXED",
    })),
    salesByBranch: dashboard.salesByBranch.map((branch) => ({
      branchId: branch.branchId,
      branchName: branch.branchName,
      total: branch.total,
    })),
    topBarbers: dashboard.topBarbers.map((barber) => ({
      barberId: barber.barberId,
      barberName: barber.barberName,
      saleCount: barber.saleCount,
    })),
  };
}

type HomeProps = {
  searchParams: Promise<{
    range?: string | string[];
    from?: string | string[];
    to?: string | string[];
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const session = await getCurrentSession();

  if (!isAdminRole(session?.user.role)) {
    return <AccessPage />;
  }

  const params = await searchParams;
  const range = parseDashboardRange(params.range);
  const dashboard = await getAdminDashboard(new Date(), {
    range,
    from: parseISODateLocal(params.from),
    to: parseISODateLocal(params.to),
  });
  const userName = session.user.name ?? "admin";
  const todayKpi = dashboard.kpis.find((kpi) => kpi.key === "today");
  const paymentTotal = dashboard.paymentBreakdown.reduce((total, payment) => total + payment.total, 0);
  const paymentChartData = dashboard.paymentBreakdown.map((payment) => ({
    ...payment,
    label: paymentMethodLabels[payment.method],
    percentage: paymentTotal > 0 ? Math.round((payment.total / paymentTotal) * 100) : 0,
  }));
  const mobileData = buildMobileData(dashboard, userName);

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-950">
      <MobileDashboard data={mobileData} />

      <div className="hidden min-h-screen md:grid lg:grid-cols-[264px_1fr]">
        <aside className="hidden border-r border-slate-200 bg-white px-5 py-6 shadow-sm lg:flex lg:flex-col">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm shadow-blue-200">
              <Scissors className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">BarberPro</p>
              <h1 className="text-lg font-black text-slate-950">Barber Bills</h1>
            </div>
          </div>

          <nav className="mt-10 space-y-1.5">
            {navigationItems.map((item) => (
              <Link
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
                  item.href === "/"
                    ? "bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                }`}
                href={item.href}
                key={item.href}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>

          <Card className="mt-8 border-slate-200 bg-slate-50 shadow-none" size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm text-slate-950">
                <CalendarDays className="size-4 text-blue-600" />
                Resumen de hoy
              </CardTitle>
              <CardDescription>{dayFormatter.format(dashboard.generatedAt)}</CardDescription>
            </CardHeader>
            <CardContent>
              <AnimatedMoney className="text-2xl font-black text-slate-950" value={todayKpi?.total ?? 0} />
              <p className="mt-2 text-sm text-slate-500">{todayKpi?.saleCount ?? 0} ventas completadas</p>
            </CardContent>
          </Card>

          <div className="mt-auto space-y-4 pt-8">
            <Separator />
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
              <div>
                <p className="font-semibold text-slate-950">{dashboard.businessName}</p>
                <p className="text-xs text-slate-500">Sesión admin</p>
              </div>
              <LogoutButton />
            </div>
          </div>
        </aside>

        <section className="min-w-0 px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-8 lg:pt-7">
          <header className="flex flex-col gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-600">Panel administrativo</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Dashboard</h2>
              <p className="mt-1 text-sm text-slate-500">
                Hola, {userName}. Actualizado {timeFormatter.format(dashboard.generatedAt)} hs.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button className="rounded-xl border-slate-200 bg-white text-slate-600" disabled type="button" variant="outline">
                Este mes
              </Button>
              <Button className="rounded-xl border-slate-200 bg-white text-slate-500" disabled type="button" variant="outline">
                <Download className="size-4" />
                Exportar
              </Button>
              <Button asChild className="rounded-xl bg-blue-600 text-white hover:bg-blue-700">
                <Link href="/sales/new">Registrar venta</Link>
              </Button>
            </div>
          </header>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {dashboard.kpis.map((kpi, index) => (
              <Card className="border-slate-200 bg-white shadow-sm" key={kpi.key} size="sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-3">
                    <CardDescription className="font-semibold text-slate-500">{kpi.label}</CardDescription>
                    <span className={`rounded-full p-1.5 ring-1 ${kpiAccentClasses[kpi.key]}`}>
                      <TrendingUp className="size-3.5" />
                    </span>
                  </div>
                  <CardTitle className="text-2xl font-black text-slate-950">
                    <AnimatedMoney delayMs={index * 90} value={kpi.total} />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs font-medium text-slate-500">{kpi.saleCount} ventas registradas</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[1.35fr_0.9fr]">
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-slate-950">Ventas por sucursal</CardTitle>
                <CardDescription>Importe vendido hoy por local activo.</CardDescription>
              </CardHeader>
              <CardContent>
                <SalesByBranchChart data={dashboard.salesByBranch} />
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-950">
                  <CreditCard className="size-4 text-blue-600" />
                  Medios de pago
                </CardTitle>
                <CardDescription>Distribución de pagos del día.</CardDescription>
              </CardHeader>
              <CardContent>
                <PaymentBreakdownChart data={paymentChartData} />
                <div className="mt-3 space-y-2">
                  {paymentChartData.length === 0 ? null : paymentChartData.map((payment) => (
                    <div className="flex items-center justify-between gap-3 text-sm" key={payment.method}>
                      <span className="text-slate-500">{payment.label}</span>
                      <span className="font-semibold text-slate-950">
                        {payment.percentage}% · {formatMoney(payment.total)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_1.35fr]">
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-slate-950">Top barberos</CardTitle>
                <CardDescription>Ranking del mes por ventas completadas.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboard.topBarbers.length === 0 ? (
                  <EmptyMessage>No hay ventas completadas este mes.</EmptyMessage>
                ) : (
                  dashboard.topBarbers.map((barber, index) => (
                    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3" key={barber.barberId}>
                      <span className="flex size-9 items-center justify-center rounded-xl bg-blue-100 text-sm font-black text-blue-700">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-950">{barber.barberName}</p>
                        <p className="text-xs text-slate-500">{barber.saleCount} ventas</p>
                      </div>
                      <p className="font-black text-slate-950">{formatMoney(barber.total)}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader className="flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-slate-950">Ventas recientes</CardTitle>
                  <CardDescription>Últimos movimientos completados de hoy.</CardDescription>
                </div>
                <Badge className="border-blue-100 bg-blue-50 text-blue-700" variant="outline">
                  {dashboard.activeBarberCount} activos
                </Badge>
              </CardHeader>
              <CardContent>
                {dashboard.recentSales.length === 0 ? (
                  <EmptyMessage>Todavía no hay ventas completadas hoy.</EmptyMessage>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-100 hover:bg-transparent">
                        <TableHead className="text-slate-500">Hora</TableHead>
                        <TableHead className="text-slate-500">Barbero</TableHead>
                        <TableHead className="hidden text-slate-500 md:table-cell">Detalle</TableHead>
                        <TableHead className="text-right text-slate-500">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboard.recentSales.map((sale) => (
                        <TableRow className="border-slate-100 hover:bg-slate-50" key={sale.id}>
                          <TableCell className="text-slate-600">{dateFormatter.format(sale.soldAt)}</TableCell>
                          <TableCell>
                            <p className="font-semibold text-slate-950">{sale.barberName}</p>
                            <p className="text-xs text-slate-500">{sale.branchName}</p>
                          </TableCell>
                          <TableCell className="hidden max-w-[260px] truncate text-slate-500 md:table-cell">
                            {sale.itemSummary || "Sin detalle"}
                          </TableCell>
                          <TableCell className="text-right font-black text-slate-950">{formatMoney(sale.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="mt-5 border-slate-200 bg-white shadow-sm">
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-slate-950">Servicios y precios por sucursal</CardTitle>
                <CardDescription>Resumen de servicios activos configurados para vender.</CardDescription>
              </div>
              <Button asChild className="rounded-xl border-slate-200 bg-white text-slate-700" variant="outline">
                <Link href="/services">Ver servicios</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {dashboard.servicePricesByBranch.length === 0 ? (
                <EmptyMessage>No hay servicios activos configurados por sucursal.</EmptyMessage>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {dashboard.servicePricesByBranch.map((branch) => (
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4" key={branch.branchId}>
                      <p className="font-black text-slate-950">{branch.branchName}</p>
                      <div className="mt-3 space-y-2">
                        {branch.services.map((service) => (
                          <div className="flex items-center justify-between gap-3 text-sm" key={service.serviceId}>
                            <span className="truncate text-slate-600">{service.serviceName}</span>
                            <span className="font-bold text-slate-950">{formatMoney(service.price)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

function AccessPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:px-6">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl flex-col justify-center">
        <Badge className="w-fit border-blue-100 bg-blue-50 text-blue-700" variant="outline">
          Barber Bills
        </Badge>
        <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-6xl">Administrá la barbería sin perder el pulso del día.</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
          Ingresá como administrador para ver el panel de ventas, reportes y rendimiento. Si sos barbero, usá la terminal de carga rápida.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild className="rounded-2xl bg-blue-600 text-white hover:bg-blue-700" size="lg">
            <Link href="/login">Ingresar como administrador</Link>
          </Button>
          <Button asChild className="rounded-2xl border-slate-200 bg-white text-slate-700 hover:bg-slate-100" size="lg" variant="outline">
            <Link href="/barber">Ir a la terminal</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">{children}</p>;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}
