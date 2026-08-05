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
      {/* Los dos filtros en una sola línea. Apilados en dos filas de píldoras
          casi iguales se leían como un tartamudeo: misma forma, mismo tamaño,
          significados distintos. Acá el período va primero y el medio de pago
          después de un separador, subordinado y en cuerpo más chico, que es la
          relación real entre los dos: el medio afina lo que el período ya
          eligió. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
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

        {/* Solo se ofrecen los medios que HAY en el período: un chip que
            devuelve una lista vacía es prometer algo que no está. Con un solo
            medio no hay nada que filtrar y no aparece nada. */}
        {metodosDisponibles.length > 1 ? (
          <>
            <span aria-hidden className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />
            <Link
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-black transition ${
                metodo ? "text-slate-500 ring-1 ring-slate-950/10" : "bg-slate-900 text-white"
              }`}
              href={url({ metodo: null })}
              scroll={false}
            >
              Todos
            </Link>
            {metodosDisponibles.map((opcion) => (
              <Link
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-black transition ${
                  opcion === metodo ? "bg-slate-900 text-white" : "text-slate-500 ring-1 ring-slate-950/10"
                }`}
                href={url({ metodo: opcion === metodo ? null : opcion })}
                key={opcion}
                scroll={false}
              >
                {etiquetasDePago[opcion] ?? opcion}
              </Link>
            ))}
          </>
        ) : null}
      </div>

      {/* Un panel y no tarjetas sueltas. Tres cajas flotando dejaban el desglose
          por medio de pago colgado a un costado, sin nada con qué alinearse, y
          en un monitor ancho quedaba media pantalla de aire entre ellas y la
          tabla. Un panel que ocupa el ancho se apoya en la tabla de abajo y los
          números quedan separados por líneas en vez de por huecos. */}
      {/* Las líneas divisorias salen del fondo gris asomando por un `gap-px`,
          no de bordes por casilla: así funcionan igual cuando es una fila en
          escritorio y una grilla de dos columnas en el celular, sin tener que
          decidir a qué casilla le toca borde de qué lado. */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-slate-100 shadow-sm ring-1 ring-slate-950/5 lg:flex lg:items-stretch">
        <Dato destacado etiqueta="Facturado" testId="total-facturado" valor={pesos.format(totales.facturado)} />
        <Dato etiqueta="Ventas" valor={String(totales.cantidad)} />
        {/* Con tres casillas en una grilla de dos columnas queda un hueco gris
            al lado de la última, que parece un error de render. Si no hay
            canceladas, la tercera ocupa el ancho y la grilla cierra. */}
        <Dato
          anchoDobleEnCelular={totales.canceladas === 0}
          etiqueta="Ticket promedio"
          valor={pesos.format(totales.ticketPromedio)}
        />
        {totales.canceladas > 0 ? (
          <Dato etiqueta="Canceladas" tono="alerta" valor={String(totales.canceladas)} />
        ) : null}

        {/* El desglose adentro del mismo panel y contra el borde derecho: es la
            respuesta a "por dónde entró", que pertenece al mismo bloque que
            "cuánto entró". */}
        {totales.porMedio.length > 0 ? (
          <div className="col-span-2 flex min-w-0 flex-1 flex-wrap items-center gap-x-6 gap-y-1 bg-white px-4 py-3 lg:justify-end lg:py-3.5">
            {totales.porMedio.map((fila) => (
              <span className="whitespace-nowrap text-sm" key={fila.metodo}>
                <span className="font-bold text-slate-500">{etiquetasDePago[fila.metodo] ?? fila.metodo}</span>{" "}
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
  anchoDobleEnCelular = false,
}: {
  etiqueta: string;
  valor: string;
  destacado?: boolean;
  tono?: "normal" | "alerta";
  testId?: string;
  anchoDobleEnCelular?: boolean;
}) {
  return (
    // Ancho mínimo y no automático: si cada casilla midiera su contenido, la de
    // "Ventas" sería un cuadradito al lado de la de "Facturado" y la fila
    // quedaría despareja. Con el mínimo entran todas parejas.
    <div
      className={`px-4 py-3.5 lg:min-w-[12rem] ${tono === "alerta" ? "bg-rose-50" : "bg-white"} ${
        anchoDobleEnCelular ? "col-span-2 lg:col-span-1" : ""
      }`}
    >
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{etiqueta}</p>
      <p
        className={`font-display mt-0.5 font-black tracking-tight ${
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
