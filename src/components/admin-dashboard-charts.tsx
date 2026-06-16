"use client";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { PaymentMethod } from "@/generated/prisma/client";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";

type SalesByBranchDatum = {
  branchId: string;
  branchName: string;
  total: number;
  saleCount: number;
};

type PaymentBreakdownDatum = {
  method: PaymentMethod;
  label: string;
  total: number;
};

const branchChartConfig = {
  total: {
    label: "Total",
    color: "#2563eb",
  },
} satisfies ChartConfig;

const paymentChartConfig = {
  total: {
    label: "Total",
  },
} satisfies ChartConfig;

const paymentColors = ["#2563eb", "#60a5fa", "#93c5fd", "#bfdbfe", "#64748b", "#cbd5e1"];

export function SalesByBranchChart({ data }: { data: SalesByBranchDatum[] }) {
  if (data.length === 0) {
    return <EmptyChartMessage>No hay ventas completadas hoy.</EmptyChartMessage>;
  }

  return (
    <ChartContainer config={branchChartConfig} className="h-[220px] w-full">
      <BarChart accessibilityLayer barCategoryGap={12} data={data} layout="vertical" margin={{ left: 4, right: 16 }}>
        <CartesianGrid horizontal={false} stroke="#e2e8f0" strokeDasharray="3 3" />
        <YAxis
          axisLine={false}
          dataKey="branchName"
          tickLine={false}
          tickMargin={8}
          tick={{ fill: "#475569", fontSize: 12 }}
          type="category"
          width={96}
        />
        <XAxis axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} tickFormatter={formatCompactCurrency} type="number" />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} />
        <Bar background={{ fill: "#eff6ff", radius: 8 }} dataKey="total" fill="var(--color-total)" radius={8} />
      </BarChart>
    </ChartContainer>
  );
}

export function PaymentBreakdownChart({ data }: { data: PaymentBreakdownDatum[] }) {
  if (data.length === 0) {
    return <EmptyChartMessage>No hay pagos registrados hoy.</EmptyChartMessage>;
  }

  return (
    <ChartContainer config={paymentChartConfig} className="mx-auto h-[210px] w-full max-w-[280px]">
      <PieChart accessibilityLayer>
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} hideLabel />} />
        <Pie data={data} dataKey="total" innerRadius={54} nameKey="label" outerRadius={86} paddingAngle={3} strokeWidth={0}>
          {data.map((entry, index) => (
            <Cell fill={paymentColors[index % paymentColors.length]} key={entry.method} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}

function EmptyChartMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
