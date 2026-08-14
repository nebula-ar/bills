"use client";

// "Detalle de ventas" del dashboard con Syncfusion EJ2 DataGrid (ej2-grids).
// Reemplaza el grid de "Últimas ventas" (que mostraba 10) por el detalle
// COMPLETO del período, con export a Excel / PDF / CSV usando las utilidades
// de export del propio grid — una sola implementación de export, la del grid.
// El route handler de /exportar (para el contador, una fila por ítem) queda
// intacto: acá se exporta lo que se ve, el detalle por venta.
//
// El CSV lo exporta el propio módulo ExcelExport (en EJ2 no hay servicio
// CsvExport aparte: el grid csvExport() mapea con isCsv=true). Todo el texto
// sale del locale global es (buscador, paginación, empty states); los botones
// del toolbar son items custom porque las etiquetas de export por defecto de
// EJ2 no están en el locale es.
import {
  ColumnDirective,
  ColumnsDirective,
  ExcelExport,
  GridComponent,
  Inject,
  Page,
  PdfExport,
  Sort,
  Toolbar,
} from "@syncfusion/ej2-react-grids";
import type { ClickEventArgs } from "@syncfusion/ej2-navigations";
import { useRef } from "react";
import type { SalesDetailRow } from "@/modules/reports/sales-detail-view";

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

export function SalesDetailGrid({ data }: { data: SalesDetailRow[] }) {
  const gridRef = useRef<GridComponent>(null);

  function handleToolbarClick(args: ClickEventArgs) {
    switch (args.item.id) {
      case "export-excel":
        void gridRef.current?.excelExport();
        break;
      case "export-pdf":
        void gridRef.current?.pdfExport();
        break;
      case "export-csv":
        void gridRef.current?.csvExport();
        break;
    }
  }

  return (
    <GridComponent
      allowExcelExport
      allowPaging
      allowPdfExport
      allowSorting
      allowTextWrap
      cssClass="e-sales-detail-grid e-dashboard-grid"
      dataSource={data}
      height="auto"
      pageSettings={{ pageSize: 8, pageSizes: [8, 16, 32] }}
      ref={gridRef}
      toolbar={TOOLBAR_ITEMS}
      toolbarClick={handleToolbarClick}
      width="100%"
    >
      <ColumnsDirective>
        {/* La columna se ordena por soldAtLabel (yyyy-mm-dd hh:mm, orden
            cronológico por string) y se MUESTRA la etiqueta compacta. Al
            exportar sale el valor del campo (la fecha completa), que es lo que
            sirve en la planilla. */}
        <ColumnDirective
          field="soldAtLabel"
          headerText="Fecha"
          template={(row: SalesDetailRow) => (
            <span style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{row.dateLabel}</span>
          )}
          width={92}
        />
        <ColumnDirective field="shortId" headerText="Venta" hideAtMedia="(min-width: 641px)" width={80} />
        <ColumnDirective
          field="staffName"
          headerText="Vendedor"
          hideAtMedia="(min-width: 641px)"
          width={110}
        />
        <ColumnDirective field="branchName" headerText="Sucursal" hideAtMedia="(min-width: 641px)" width={100} />
        <ColumnDirective
          clipMode="Ellipsis"
          field="customerLabel"
          headerText="Cliente"
          hideAtMedia="(min-width: 641px)"
          width={130}
        />
        <ColumnDirective clipMode="Ellipsis" field="itemSummary" headerText="Detalle" width="auto" />
        <ColumnDirective
          field="paymentLabel"
          headerText="Pago"
          headerTextAlign="Right"
          hideAtMedia="(min-width: 641px)"
          textAlign="Right"
          width={110}
        />
        <ColumnDirective
          field="total"
          headerText="Total"
          headerTextAlign="Right"
          template={(row: SalesDetailRow) => (
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{formatMoney(row.total)}</span>
          )}
          textAlign="Right"
          width="18%"
        />
      </ColumnsDirective>
      <Inject services={[Page, Sort, Toolbar, ExcelExport, PdfExport]} />
    </GridComponent>
  );
}

const TOOLBAR_ITEMS = [
  "Search",
  { id: "export-excel", text: "Exportar Excel", tooltipText: "Exportar a Excel", prefixIcon: "e-export-excel" },
  { id: "export-pdf", text: "Exportar PDF", tooltipText: "Exportar a PDF", prefixIcon: "e-export-pdf" },
  { id: "export-csv", text: "Exportar CSV", tooltipText: "Exportar a CSV", prefixIcon: "e-export-csv" },
];
