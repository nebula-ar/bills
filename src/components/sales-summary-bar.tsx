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
  /** Medio de pago filtrado, si hay alguno. */
  metodo?: string;
  /** Medios presentes en el período, sin el filtro aplicado. */
  metodosDisponibles: string[];
};

export function SalesSummaryBar({
  periodo,
  totales,
  etiquetasDePago,
  metodo,
  metodosDisponibles,
}: Props) {
  // El período manda y el medio lo acompaña: cambiar de período conserva el
  // medio elegido, para poder seguir la misma pregunta a través del tiempo.
  const url = (cambios: { periodo?: Periodo; metodo?: string | null }) => {
    const p = cambios.periodo ?? periodo;
    const m = cambios.metodo === undefined ? metodo : cambios.metodo;
    const query = new URLSearchParams();
    if (p !== "hoy") query.set("periodo", p);
    if (m) query.set("metodo", m);
    const cadena = query.toString();
    return cadena ? `/sales?${cadena}` : "/sales";
  };

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
            href={url({ periodo: opcion })}
            key={opcion}
            // `scroll={false}`: cambiar de período no es navegar a otra
            // pantalla, y saltar al tope aleja los números de donde estabas.
            scroll={false}
          >
            {PERIODO_LABELS[opcion]}
          </Link>
        ))}
      </div>

      {/* Filtro por medio de pago. Solo se ofrecen los que HAY en el período:
          un chip que devuelve una lista vacía es prometer algo que no está.
          Con un solo medio no hay nada que filtrar y la fila no aparece. */}
      {metodosDisponibles.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-black transition ${
              metodo ? "bg-white text-slate-600 ring-1 ring-slate-950/5" : "bg-slate-900 text-white"
            }`}
            href={url({ metodo: null })}
            scroll={false}
          >
            Todos los pagos
          </Link>
          {metodosDisponibles.map((opcion) => (
            <Link
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-black transition ${
                opcion === metodo ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-950/5"
              }`}
              href={url({ metodo: opcion === metodo ? null : opcion })}
              key={opcion}
              scroll={false}
            >
              {etiquetasDePago[opcion] ?? opcion}
            </Link>
          ))}
        </div>
      ) : null}

      {/* En escritorio, los números a la izquierda y el desglose por medio de
          pago a la derecha, en la misma fila. Estirar tres tarjetas a lo ancho
          de la pantalla las convierte en carteles con un número en un rincón:
          el ancho de más se aprovecha poniendo otra información al lado, no
          inflando la que ya está. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        {/* Tres números, y un cuarto SOLO si hay algo que avisar. Rellenar la
            cuarta casilla con un dato que ya está en las píldoras es ruido. */}
        <div className="grid grid-cols-2 gap-3 lg:flex lg:shrink-0">
          <Dato destacado etiqueta="Facturado" testId="total-facturado" valor={pesos.format(totales.facturado)} />
          <Dato etiqueta="Ventas" valor={String(totales.cantidad)} />
          <Dato etiqueta="Ticket promedio" valor={pesos.format(totales.ticketPromedio)} />
          {totales.canceladas > 0 ? (
            <Dato etiqueta="Canceladas" tono="alerta" valor={String(totales.canceladas)} />
          ) : null}
        </div>

        {totales.porMedio.length > 0 ? (
          <div className="flex min-w-0 flex-1 flex-wrap gap-2 lg:pt-1">
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
    // Ancho mínimo y no automático: si cada tarjeta midiera su contenido, la de
    // "Ventas" sería un cuadradito al lado de la de "Facturado" y la fila
    // quedaría desprolija. Con el mínimo entran todas parejas.
    <div
      className={`rounded-2xl p-3.5 shadow-sm ring-1 lg:min-w-[13rem] ${
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
