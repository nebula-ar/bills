"use client";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { PAYMENT_DONUT_COLORS } from "@/components/reports-charts-colors";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";

type TrendDatum = {
  label: string;
  total: number;
};

const donutChartConfig = {
  total: { label: "Total" },
} satisfies ChartConfig;

export function PaymentDonutChart({ data }: { data: { key: string; label: string; total: number }[] }) {
  return (
    <ChartContainer className="mx-auto h-[210px] w-full max-w-[260px]" config={donutChartConfig}>
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} hideLabel />} />
        <Pie data={data} dataKey="total" innerRadius={56} nameKey="label" outerRadius={92} paddingAngle={3} strokeWidth={0}>
          {data.map((entry, index) => (
            <Cell fill={PAYMENT_DONUT_COLORS[index % PAYMENT_DONUT_COLORS.length]} key={entry.key} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}

const trendChartConfig = {
  total: {
    label: "Total",
    color: "#3158e8",
  },
} satisfies ChartConfig;

export function SalesTrendChart({ data }: { data: TrendDatum[] }) {
  return (
    <ChartContainer className="h-[200px] w-full" config={trendChartConfig}>
      <BarChart accessibilityLayer barCategoryGap={data.length > 12 ? 2 : 10} data={data} margin={{ left: 4, right: 8, top: 8 }}>
        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="label"
          interval="preserveStartEnd"
          tick={{ fill: "#64748b", fontSize: 11 }}
          tickLine={false}
          tickMargin={8}
        />
        <YAxis
          axisLine={false}
          tick={{ fill: "#64748b", fontSize: 11 }}
          tickFormatter={formatCompactCurrency}
          tickLine={false}
          width={44}
        />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} />
        <Bar dataKey="total" fill="var(--color-total)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ChartContainer>
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
