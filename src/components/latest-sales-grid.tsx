"use client";

// "Últimas ventas" del dashboard con Syncfusion EJ2 DataGrid (ej2-grids).
// Reemplaza la lista custom por un grid real: ordena las columnas, respeta el
// locale es ("No hay registros que mostrar" sale del locale global) y esconde
// columnas secundarias en pantallas chicas para no romper el mobile-first.
import { GridComponent, ColumnsDirective, ColumnDirective } from "@syncfusion/ej2-react-grids";

export type LatestSaleRow = {
  id: string;
  timeLabel: string;
  staffName: string;
  branchName: string;
  total: number;
  paymentLabel: string;
  itemSummary: string;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

export function LatestSalesGrid({ data }: { data: LatestSaleRow[] }) {
  return (
    <GridComponent allowTextWrap cssClass="e-dashboard-grid" dataSource={data} height="auto" width="100%">
      <ColumnsDirective>
        {/* Anchos en % (no px) + columnas flexibles: en viewports chicos el grid
            no genera scrollbar horizontal. En mobile (<641px) se ocultan Hora y
            Pago (secundarias) y queda Empleado + Detalle + Total.
            OJO con hideAtMedia: la columna se muestra cuando la media query
            MATCHES (col.visible = e.matches en ej2-grids), así que para ocultar
            por debajo de 640px la query correcta es (min-width: 641px). */}
        <ColumnDirective field="timeLabel" headerText="Hora" hideAtMedia="(min-width: 641px)" width={70} />
        <ColumnDirective field="staffName" headerText="Empleado" width="24%" />
        <ColumnDirective
          clipMode="Ellipsis"
          field="itemSummary"
          headerText="Detalle"
          width="auto"
        />
        <ColumnDirective
          field="paymentLabel"
          headerText="Pago"
          headerTextAlign="Right"
          hideAtMedia="(min-width: 641px)"
          textAlign="Right"
        />
        <ColumnDirective
          field="total"
          headerText="Total"
          headerTextAlign="Right"
          template={(row: LatestSaleRow) => (
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{formatMoney(row.total)}</span>
          )}
          textAlign="Right"
          width="22%"
        />
      </ColumnsDirective>
    </GridComponent>
  );
}
