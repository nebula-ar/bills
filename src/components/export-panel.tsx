"use client";

import { ArrowUpRight } from "@/components/icons";
import { inputClass } from "@/components/manager-ui";
import { useState } from "react";

// Panel de exportación. Es cliente solo porque las fechas del formulario tienen
// que llegar a la URL de descarga; el archivo lo arma el route handler.

export function ExportPanel({
  datasets,
  defaultFrom,
  defaultTo,
}: {
  datasets: { value: string; label: string; hint: string }[];
  defaultFrom: string;
  defaultTo: string;
}) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  const invalid = !from || !to || from > to;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
          Desde
          <input className={inputClass} onChange={(event) => setFrom(event.target.value)} type="date" value={from} />
        </label>
        <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
          Hasta
          <input className={inputClass} onChange={(event) => setTo(event.target.value)} type="date" value={to} />
        </label>
      </div>

      {invalid ? <p className="text-sm font-bold text-rose-600">Revisá el rango: el desde tiene que ser anterior.</p> : null}

      <div className="grid gap-2.5 sm:grid-cols-3">
        {datasets.map((dataset) => (
          <a
            aria-disabled={invalid}
            className={`flex flex-col gap-1 rounded-2xl border border-slate-200 p-3.5 transition active:scale-[0.99] ${
              invalid ? "pointer-events-none opacity-40" : "hover:border-blue-300"
            }`}
            download
            href={`/api/export?dataset=${dataset.value}&from=${from}&to=${to}`}
            key={dataset.value}
          >
            <span className="flex items-center gap-1.5 text-sm font-black text-slate-950">
              {dataset.label}
              <ArrowUpRight className="size-3.5 text-blue-600" />
            </span>
            <span className="text-xs text-slate-500">{dataset.hint}</span>
          </a>
        ))}
      </div>

      <p className="text-xs text-slate-400">
        Los archivos salen en CSV separado por punto y coma, que es lo que abre bien el Excel en español.
      </p>
    </div>
  );
}
