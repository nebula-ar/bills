import { requireAdminSession } from "@/lib/auth";
import { csvFilename } from "@/modules/reports/csv.logic";
import { buildExport, isExportDataset } from "@/modules/reports/export.use-case";
import type { NextRequest } from "next/server";

// Descarga del CSV para el contador. Va por route handler porque una server
// action no puede devolver un archivo: acá el navegador dispara la descarga
// directo con el nombre correcto.

export async function GET(request: NextRequest) {
  const session = await requireAdminSession();

  const params = request.nextUrl.searchParams;
  const dataset = params.get("dataset") ?? "ventas";

  if (!isExportDataset(dataset)) {
    return new Response("Dataset desconocido", { status: 400 });
  }

  const from = parseDay(params.get("from"));
  const to = parseDay(params.get("to"));

  if (!from || !to) {
    return new Response("Rango de fechas inválido", { status: 400 });
  }

  // El "hasta" incluye el día entero: quien pide del 1 al 31 espera el 31.
  to.setHours(23, 59, 59, 999);

  if (from > to) {
    return new Response("La fecha de inicio es posterior a la de fin", { status: 400 });
  }

  const csv = await buildExport({ businessId: session.user.businessId, dataset, from, to });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename(dataset, from, to)}"`,
      // Datos del negocio: nunca en un caché compartido.
      "Cache-Control": "private, no-store",
    },
  });
}

function parseDay(value: string | null): Date | null {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;

  if (!match) return null;

  const day = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(day.getTime()) ? null : day;
}
