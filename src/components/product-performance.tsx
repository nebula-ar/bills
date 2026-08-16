"use client";

import { useEffect, useState, useTransition } from "react";

import { getProductRendimiento, type RendimientoResult } from "@/app/catalog/actions";
import { Loader2, TrendingDown, TrendingUp } from "@/components/icons";

// Cómo le fue al producto CONTRA el resto.
//
// Las tarjetas de arriba dicen cuánto vendió; esto dice si eso es mucho o poco.
// $200.000 puede ser el producto que sostiene el mostrador o el que apenas
// asoma, y el número solo no lo distingue.

type Datos = Extract<RendimientoResult, { ok: true }>["rendimiento"];

export function ProductPerformance({
  activa,
  periodo,
  productId,
}: {
  activa: boolean;
  periodo: string;
  productId: string;
}) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, empezar] = useTransition();

  // Se vuelve a preguntar al cambiar el período: si no, el ranking seguiría
  // hablando del mes pasado con las tarjetas de arriba mostrando la semana.
  //
  // El estado se toca SOLO adentro del callback, nunca sincrónico en el cuerpo
  // del efecto (eso encadena renders). Y `vigente` descarta la respuesta que
  // llega tarde: cambiando de período rápido, la consulta vieja puede contestar
  // después que la nueva y dejar en pantalla el ranking equivocado.
  useEffect(() => {
    if (!activa) return;
    let vigente = true;

    empezar(async () => {
      const resultado = await getProductRendimiento(productId, periodo);
      if (!vigente) return;
      if (resultado.ok) {
        setDatos(resultado.rendimiento);
        setError(null);
      } else {
        setError(resultado.error);
      }
    });

    return () => {
      vigente = false;
    };
  }, [activa, periodo, productId]);

  if (!activa) return null;

  return (
    <section className="grid gap-2">
      <p className="text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500">Rendimiento</p>

      {error ? <p className="text-sm font-bold text-rose-600">{error}</p> : null}

      {!datos && !error ? (
        <p className="flex items-center gap-2 py-2 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" />
          Comparando…
        </p>
      ) : null}

      {datos ? (
        <div className={`grid gap-3 transition-opacity sm:grid-cols-3 ${cargando ? "opacity-50" : ""}`}>
          <Tarjeta
            etiqueta="Ranking"
            // Sin ventas no hay puesto: poner "#0" o el último lugar diría que
            // compitió y salió mal, cuando en realidad no compitió.
            nota={
              datos.puesto === null
                ? "sin ventas en el período"
                : `de ${datos.deCuantos} en ${datos.categoriaNombre ?? "el catálogo"}`
            }
            valor={datos.puesto === null ? "—" : `#${datos.puesto}`}
          />
          <Tarjeta
            etiqueta="Participación"
            nota="de lo que facturó el negocio"
            valor={datos.participacion === null ? "—" : `${datos.participacion}%`}
          />
          <Tarjeta
            etiqueta="Comparación"
            // null no es 0%: es que antes no se vendía nada. Un "+100%" ahí
            // inventaría una base y lo dejaría igual que uno que duplicó.
            nota={datos.variacion === null ? "no se vendía antes" : "vs período anterior"}
            tono={datos.variacion === null ? "neutro" : datos.variacion >= 0 ? "bueno" : "malo"}
            valor={datos.variacion === null ? "Nuevo" : `${datos.variacion > 0 ? "+" : ""}${datos.variacion}%`}
          />
        </div>
      ) : null}
    </section>
  );
}

function Tarjeta({
  etiqueta,
  nota,
  valor,
  tono = "neutro",
}: {
  etiqueta: string;
  nota: string;
  valor: string;
  tono?: "neutro" | "bueno" | "malo";
}) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-950/5">
      <p className="text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500">{etiqueta}</p>
      <p
        className={`mt-0.5 flex items-center gap-1.5 text-xl font-black ${
          tono === "bueno" ? "text-emerald-700" : tono === "malo" ? "text-rose-600" : "text-slate-950"
        }`}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {valor}
        {/* La flecha acompaña al signo, no lo reemplaza: quien no distingue
            verde de rojo lee el "+" y la flecha igual. */}
        {tono === "bueno" ? <TrendingUp className="size-4" /> : null}
        {tono === "malo" ? <TrendingDown className="size-4" /> : null}
      </p>
      <p className="text-[0.6875rem] text-slate-500">{nota}</p>
    </div>
  );
}
