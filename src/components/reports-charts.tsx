"use client";

// Gráficos del dashboard con Syncfusion EJ2 (ej2-charts). Reemplazan la
// dependencia recharts (stack anterior). El tema de colores del donut se
// mantiene igual que antes para no cambiar la lectura visual.
import {
  AccumulationChartComponent,
  AccumulationLegend,
  AccumulationSeriesCollectionDirective,
  AccumulationSeriesDirective,
  AccumulationTooltip,
  Category,
  ChartComponent,
  ColumnSeries,
  Inject,
  Legend,
  PieSeries,
  SeriesCollectionDirective,
  SeriesDirective,
  Tooltip,
  type ITooltipRenderEventArgs,
  type IAxisLabelRenderEventArgs,
} from "@syncfusion/ej2-react-charts";
import { PAYMENT_DONUT_COLORS } from "@/components/reports-charts-colors";

type TrendDatum = {
  label: string;
  total: number;
};

const BRAND_BLUE = "#3158e8";
const AXIS_LABEL_STYLE = { color: "#64748b", size: "11px" };

function formatMoney(value: number) {
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

export function PaymentDonutChart({ data }: { data: { key: string; label: string; total: number }[] }) {
  // pointColorMapping: cada sector conserva el color que ya usaba la leyenda
  // del dashboard (misma paleta, misma lectura).
  const colored = data.map((entry, index) => ({
    ...entry,
    color: PAYMENT_DONUT_COLORS[index % PAYMENT_DONUT_COLORS.length],
  }));

  function onTooltipRender(args: ITooltipRenderEventArgs) {
    const point = (args as unknown as { point?: { x?: string | number; y?: number } }).point;
    if (point) {
      args.text = `${point.x}: ${formatMoney(Number(point.y))}`;
    }
  }

  return (
    <AccumulationChartComponent
      accessibility={{ accessibilityDescription: "Gráfico interactivo de métodos de pago" }}
      className="mx-auto"
      height="210px"
      legendSettings={{ visible: false }}
      style={{ maxWidth: 260 }}
      tooltip={{ enable: true }}
      tooltipRender={onTooltipRender}
      width="100%"
    >
      <Inject services={[PieSeries, AccumulationLegend, AccumulationTooltip]} />
      <AccumulationSeriesCollectionDirective>
        <AccumulationSeriesDirective
          dataSource={colored}
          innerRadius="58%"
          name="Total"
          radius="92%"
          pointColorMapping="color"
          type="Pie"
          xName="label"
          yName="total"
        />
      </AccumulationSeriesCollectionDirective>
    </AccumulationChartComponent>
  );
}

export function SalesTrendChart({ data }: { data: TrendDatum[] }) {
  function onTooltipRender(args: ITooltipRenderEventArgs) {
    const point = (args as unknown as { point?: { x?: string | number; y?: number } }).point;
    if (point) {
      args.text = `${point.x}: ${formatMoney(Number(point.y))}`;
    }
  }

  function onAxisLabelRender(args: IAxisLabelRenderEventArgs) {
    if (args.axis.name === "primaryYAxis") {
      args.text = formatCompactCurrency(Number(args.value));
    }
  }

  return (
    <ChartComponent
      accessibility={{ accessibilityDescription: "Gráfico interactivo de ventas por día" }}
      height="200px"
      legendSettings={{ visible: false }}
      primaryXAxis={{
        valueType: "Category",
        labelStyle: AXIS_LABEL_STYLE,
        majorGridLines: { width: 0 },
        majorTickLines: { width: 0 },
        lineStyle: { color: "#e2e8f0" },
        edgeLabelPlacement: "Shift",
      }}
      primaryYAxis={{
        labelStyle: AXIS_LABEL_STYLE,
        majorGridLines: { color: "#e2e8f0", width: 1 },
        majorTickLines: { width: 0 },
        lineStyle: { width: 0 },
      }}
      tooltip={{ enable: true }}
      tooltipRender={onTooltipRender}
      axisLabelRender={onAxisLabelRender}
      width="100%"
    >
      <Inject services={[ColumnSeries, Category, Tooltip, Legend]} />
      <SeriesCollectionDirective>
        <SeriesDirective
          accessibility={{
            accessibilityDescription: "Serie de ventas por día",
            accessibilityDescriptionFormat: "${point.x}: ${point.y}",
          }}
          dataSource={data}
          fill={BRAND_BLUE}
          name="Total"
          type="Column"
          width={2}
          xName="label"
          yName="total"
        />
      </SeriesCollectionDirective>
    </ChartComponent>
  );
}
