"use client";

import { ArrowUpRight, FileDown, FileSpreadsheet, FileText, Loader2 } from "@/components/icons";
import { inputClass } from "@/components/manager-ui";
import { toast } from "sonner";
import { useState } from "react";
import type { MouseEvent } from "react";

import type { ExportDataset, ExportFormat } from "@/modules/reports/export.use-case";

// Panel de exportación. Es cliente porque las fechas del formulario tienen que
// llegar a la URL de descarga Y porque la descarga se hace por fetch: así el
// botón avisa "Procesando…" mientras el servidor arma el archivo (el PDF de
// un mes completo tarda) y muestra el error si el route handler lo rechaza.
// El archivo lo arma `/api/export`.

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
  // La descarga que está en curso ("dataset:format") para avisarle al usuario;
  // mientras hay una, las demás quedan deshabilitadas para no encadenar
  // archivos pesados.
  const [pending, setPending] = useState<string | null>(null);

  const invalid = !from || !to || from > to;

  async function handleDownload(event: MouseEvent<HTMLAnchorElement>, key: string, url: string) {
    event.preventDefault();

    if (invalid || pending) return;

    setPending(key);
    try {
      const response = await fetch(url, { credentials: "same-origin" });

      if (!response.ok) {
        const message = await response.text();
        toast.error(message || "No se pudo armar la planilla. Probá de nuevo.");
        return;
      }

      const blob = await response.blob();
      // Mismo nombre de archivo que manda el servidor en Content-Disposition;
      // si por algo faltara, se arma uno equivalente desde la URL.
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = downloadFilename(response, url);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error("No se pudo exportar. Revisá la conexión e intentá de nuevo.");
    } finally {
      setPending(null);
    }
  }

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
              invalid || pending ? "opacity-40" : "hover:border-primary/30"
            }`}
            key={dataset.value}
          >
            <span className="flex items-center gap-1.5 text-sm font-black text-slate-950">
              {dataset.label}
              <ArrowUpRight className="size-3.5 text-primary" />
            </span>
            <span className="text-xs text-slate-500">{dataset.hint}</span>

            <div className="flex flex-wrap gap-1.5">
              {dataset.formats.map((format) => {
                const key = `${dataset.value}:${format}`;
                const isPending = pending === key;

                return (
                  <a
                    aria-disabled={invalid || pending !== null}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition active:scale-[0.99] ${
                      invalid || pending !== null
                        ? "pointer-events-none"
                        : "bg-slate-100 text-slate-700 hover:bg-primary/10 hover:text-primary"
                    }`}
                    href={`/api/export?dataset=${dataset.value}&format=${format}&from=${from}&to=${to}`}
                    key={format}
                    onClick={(event) => handleDownload(event, key, event.currentTarget.href)}
                    tabIndex={invalid || pending !== null ? -1 : undefined}
                  >
                    {isPending ? <Loader2 className="size-3.5 animate-spin" /> : formatIcon(format)}
                    {isPending ? "Procesando…" : formatLabel(format)}
                  </a>
                );
              })}
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

// El nombre de archivo que el servidor manda en `Content-Disposition:
// attachment; filename="..."`. Falla a un nombre armado desde la URL.
function downloadFilename(response: Response, url: string): string {
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = /filename="?([^";]+)"?/.exec(disposition);

  if (match?.[1]) return match[1];

  const lastSegment = url.split("?").at(0)?.split("/").at(-1) ?? "exportacion";
  return lastSegment || "exportacion";
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
