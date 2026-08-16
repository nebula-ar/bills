"use client";

import { useEffect, useState, useTransition } from "react";

import { getProductDailySeries } from "@/app/catalog/actions";
import { Loader2 } from "@/components/icons";

// Ventas del producto, día por día.
//
// Las cuatro tarjetas de arriba dicen CUÁNTO; esto dice CUÁNDO, que es otra
// pregunta: 128 unidades vendidas pueden ser veinte por día o ciento veinte un
// sábado, y lo que se compra la semana que viene depende de cuál de las dos es.
//
// Barras en HTML y no una librería de gráficos: son siete valores y un eje. Una
// dependencia de 90 kB para esto se paga en cada carga de la ficha.

const DIAS = 7;

type Dia = { dia: string; etiqueta: string; facturado: number };

export function ProductSalesChart({
  activa,
  productId,
  formatearPesos,
}: {
  activa: boolean;
  productId: string;
  formatearPesos: (valor: number) => string;
}) {
  const [serie, setSerie] = useState<Dia[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, empezar] = useTransition();

  useEffect(() => {
    if (!activa || serie !== null || cargando) return;

    empezar(async () => {
      const resultado = await getProductDailySeries(productId, DIAS);
      if (resultado.ok) setSerie(resultado.serie);
      else setError(resultado.error);
    });
  }, [activa, cargando, productId, serie]);

  if (!activa) return null;

  const tope = serie ? serie.reduce((max, d) => Math.max(max, d.facturado), 0) : 0;

  return (
    <section className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-950/5">
      <p className="text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500">
        Ventas · últimos {DIAS} días
      </p>

      {error ? <p className="mt-2 text-sm font-bold text-rose-600">{error}</p> : null}

      {serie === null && !error ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" />
          Buscando…
        </p>
      ) : null}

      {/* Sin ventas se dice, no se dibuja un gráfico plano: siete barras en cero
          parecen un gráfico roto, no una semana sin vender. */}
      {serie && tope === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No hubo ventas en los últimos {DIAS} días.</p>
      ) : null}

      {serie && tope > 0 ? (
        <div className="mt-3">
          <div className="flex h-32 items-end justify-between gap-1.5">
            {serie.map((dia) => (
              <div className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1" key={dia.dia}>
                {/* El monto arriba de la barra y no en un tooltip: en mobile no
                    hay hover, y un dato que solo aparece al pasar el mouse no
                    existe para medio uso de la app. */}
                <span className="text-[0.625rem] font-bold text-slate-500" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {dia.facturado > 0 ? formatearPesos(dia.facturado) : ""}
                </span>
                <div
                  aria-label={`${dia.etiqueta}: ${formatearPesos(dia.facturado)}`}
                  className={`w-full rounded-t-md ${dia.facturado > 0 ? "bg-primary" : "bg-slate-200"}`}
                  role="img"
                  // Mínimo visible para el día en cero: una barra de 0px deja el
                  // día sin representación y se lee como si no existiera.
                  style={{ height: `${Math.max(3, (dia.facturado / tope) * 100)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between gap-1.5">
            {serie.map((dia) => (
              <span
                className="min-w-0 flex-1 truncate text-center text-[0.625rem] font-semibold text-slate-400"
                key={dia.dia}
              >
                {dia.etiqueta}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
