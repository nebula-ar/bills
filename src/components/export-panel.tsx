"use client";

import { ArrowUpRight, FileDown, FileSpreadsheet, FileText } from "@/components/icons";
import { inputClass } from "@/components/manager-ui";
import { useState } from "react";

import type { ExportDataset, ExportFormat } from "@/modules/reports/export.use-case";

// Panel de exportación. Es cliente solo porque las fechas del formulario tienen
// que llegar a la URL de descarga; el archivo lo arma el route handler.

export function ExportPanel({
  datasets,
  defaultFrom,
  defaultTo,
}: {
  datasets: { value: ExportDataset; label: string; hint: string; formats: ExportFormat[] }[];
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

      <div className="grid gap-2.5 sm:grid-cols-2">
        {datasets.map((dataset) => (
          <div
            className={`flex flex-col gap-2 rounded-2xl border border-slate-200 p-3.5 transition ${
              invalid ? "opacity-40" : "hover:border-primary/30"
            }`}
            key={dataset.value}
          >
            <span className="flex items-center gap-1.5 text-sm font-black text-slate-950">
              {dataset.label}
              <ArrowUpRight className="size-3.5 text-primary" />
            </span>
            <span className="text-xs text-slate-500">{dataset.hint}</span>

            <div className="flex flex-wrap gap-1.5">
              {dataset.formats.map((format) => (
                <a
                  aria-disabled={invalid}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition active:scale-[0.99] ${
                    invalid
                      ? "pointer-events-none"
                      : "bg-slate-100 text-slate-700 hover:bg-primary/10 hover:text-primary"
                  }`}
                  download
                  href={`/api/export?dataset=${dataset.value}&format=${format}&from=${from}&to=${to}`}
                  key={format}
                >
                  {formatIcon(format)}
                  {formatLabel(format)}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400">
        Los archivos salen con el período completo y se abren en Excel o en el lector de PDF.
      </p>
    </div>
  );
}

function formatLabel(format: ExportFormat): string {
  if (format === "xlsx") return "Excel";
  if (format === "pdf") return "PDF";
  return "CSV";
}

function formatIcon(format: ExportFormat) {
  if (format === "xlsx") return <FileSpreadsheet className="size-3.5" />;
  if (format === "pdf") return <FileText className="size-3.5" />;
  return <FileDown className="size-3.5" />;
}
