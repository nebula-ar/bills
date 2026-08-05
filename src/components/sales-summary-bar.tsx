import Link from "next/link";

import { PERIODO_LABELS, PERIODOS, type Periodo } from "@/modules/sales/sales-period.logic";
import type { Totales } from "@/modules/sales/sales-summary.logic";

/**
 * Encabezado del historial: qué período se está mirando y cómo fue.
 *
 * Los filtros son links y no botones con estado: el período queda en la URL, así
 * que "cómo me fue este mes" se puede compartir, poner en favoritos y volver
 * atrás con el botón del navegador. Además la página sigue siendo de servidor y
 * no hay que traerse todas las ventas al cliente para filtrarlas.
 */

const pesos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

type Props = {
  periodo: Periodo;
  totales: Totales;
  /** Etiquetas lindas de los medios de pago; la lógica trabaja con el enum. */
  etiquetasDePago: Record<string, string>;
};

export function SalesSummaryBar({ periodo, totales, etiquetasDePago }: Props) {
  return (
    <div className="mt-4 space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {PERIODOS.map((opcion) => (
          <Link
            className={`shrink-0 rounded-full px-4 py-2 text-base font-black transition ${
              opcion === periodo
                ? "bg-primary text-white shadow-sm shadow-primary/25"
                : "bg-white text-slate-600 ring-1 ring-slate-950/5"
            }`}
            href={opcion === "hoy" ? "/sales" : `/sales?periodo=${opcion}`}
            key={opcion}
            // `scroll={false}`: cambiar de período no es navegar a otra
            // pantalla, y saltar al tope aleja los números de donde estabas.
            scroll={false}
          >
            {PERIODO_LABELS[opcion]}
          </Link>
        ))}
      </div>

      {/* Tres números, y un cuarto SOLO si hay algo que avisar. Rellenar la
          cuarta casilla con un dato que ya está abajo en las píldoras es ruido:
          el ojo lo lee igual y no aporta nada. */}
      <div className={`grid grid-cols-2 gap-3 ${totales.canceladas > 0 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        <Dato destacado etiqueta="Facturado" testId="total-facturado" valor={pesos.format(totales.facturado)} />
        <Dato etiqueta="Ventas" valor={String(totales.cantidad)} />
        <Dato etiqueta="Ticket promedio" valor={pesos.format(totales.ticketPromedio)} />
        {totales.canceladas > 0 ? (
          <Dato etiqueta="Canceladas" tono="alerta" valor={String(totales.canceladas)} />
        ) : null}
      </div>

      {totales.porMedio.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {totales.porMedio.map((fila) => (
            <span
              className="rounded-full bg-white px-3.5 py-2 text-sm font-bold text-slate-600 ring-1 ring-slate-950/5"
              key={fila.metodo}
            >
              {etiquetasDePago[fila.metodo] ?? fila.metodo}{" "}
              <span className="font-black text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
                {pesos.format(fila.monto)}
              </span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Dato({
  etiqueta,
  valor,
  destacado = false,
  tono = "normal",
  testId,
}: {
  etiqueta: string;
  valor: string;
  destacado?: boolean;
  tono?: "normal" | "alerta";
  testId?: string;
}) {
  return (
    <div
      className={`rounded-2xl p-3.5 shadow-sm ring-1 ${
        tono === "alerta" ? "bg-rose-50 ring-rose-200" : "bg-white ring-slate-950/5"
      }`}
    >
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{etiqueta}</p>
      <p
        className={`font-display mt-1 font-black tracking-tight ${
          tono === "alerta" ? "text-rose-700" : destacado ? "text-primary" : "text-slate-950"
        } ${destacado ? "text-3xl" : "text-2xl"}`}
        data-testid={testId}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {valor}
      </p>
    </div>
  );
}
