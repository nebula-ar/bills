"use client";

import { useEffect, useState, useTransition } from "react";

import { getProductHistory, type CambioDeFicha } from "@/app/catalog/actions";
import { Loader2 } from "@/components/icons";
import { ProductChangeField } from "@/generated/prisma/enums";
import { formatQuantity } from "@/lib/quantity";

// Historial de cambios del producto: qué se tocó, de qué a qué y quién.
//
// Existe por las discusiones que aparecen solas: "¿por qué está a 9.520?",
// "yo no cambié eso". Sin registro, la respuesta es la memoria de alguien.

const pesos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const ETIQUETAS: Record<ProductChangeField, string> = {
  NAME: "Nombre",
  PRICE: "Precio",
  COST: "Costo",
  DESCRIPTION: "Descripción",
  AVAILABILITY: "Disponibilidad",
  MIN_STOCK: "Stock mínimo",
  IDEAL_STOCK: "Stock ideal",
  SKU: "Código interno",
  BARCODE: "Código de barras",
  CATEGORY: "Categoría",
};

export function ProductHistory({ activa, productId }: { activa: boolean; productId: string }) {
  const [cambios, setCambios] = useState<CambioDeFicha[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, empezar] = useTransition();

  useEffect(() => {
    if (!activa || cambios !== null || cargando) return;

    empezar(async () => {
      const resultado = await getProductHistory(productId);
      if (resultado.ok) setCambios(resultado.cambios);
      else setError(resultado.error);
    });
  }, [activa, cambios, cargando, productId]);

  if (!activa) return null;

  return (
    <section className="grid gap-2">
      {error ? <p className="text-sm font-bold text-rose-600">{error}</p> : null}

      {cambios === null && !error ? (
        <p className="flex items-center gap-2 py-3 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" />
          Buscando…
        </p>
      ) : null}

      {/* El historial arranca vacío para todo lo que ya estaba cargado: se
          registra desde que existe, no hacia atrás. Decirlo evita que parezca
          que se perdió algo. */}
      {cambios?.length === 0 ? (
        <p className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-500">
          Todavía no hay cambios registrados. A partir de ahora se anota cada vez que se toque el precio, el costo o
          los datos del producto.
        </p>
      ) : null}

      {cambios && cambios.length > 0
        ? agruparPorDia(cambios).map((grupo) => (
        <div key={grupo.dia}>
          {/* Agrupado por día: antes cada renglón repetía "Hoy" al costado, y
              cinco cambios de la misma tarde eran cinco veces la misma palabra
              sin decir nada nuevo. El día se dice una vez y el renglón se queda
              solo con la hora. */}
          <p className="mb-1.5 mt-3 text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500 first:mt-0">
            {grupo.dia}
          </p>
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl ring-1 ring-slate-950/5">
          {grupo.cambios.map((cambio) => (
            <li className="flex items-start gap-3 bg-white px-4 py-3" key={cambio.id}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-950">{ETIQUETAS[cambio.field]}</p>
                {/* De qué a qué, en una línea. El valor viejo tachado no: se
                    lee peor y en un cambio de precio los dos números importan
                    igual. */}
                <p className="mt-0.5 text-sm text-slate-600">
                  <span className="text-slate-400">{mostrar(cambio.field, cambio.previous)}</span>
                  <span aria-label="cambió a" className="px-1.5 text-slate-400">
                    →
                  </span>
                  <span className="font-bold text-slate-950">{mostrar(cambio.field, cambio.next)}</span>
                </p>
                {cambio.autor ? <p className="mt-0.5 text-xs text-slate-500">por {cambio.autor}</p> : null}
              </div>
              <time className="shrink-0 text-xs font-semibold text-slate-400" dateTime={cambio.changedAt}>
                {hora(cambio.changedAt)}
              </time>
            </li>
          ))}
        </ul>
        </div>
          ))
        : null}
    </section>
  );
}

/**
 * El valor guardado es crudo (el entero de la plata, las milésimas del stock).
 * El formato se pone acá y no al guardar: así el historial viejo se muestra con
 * el formato de hoy en vez de congelar el de entonces.
 */
function mostrar(field: ProductChangeField, valor: string | null) {
  if (valor === null) return "—";

  if (field === ProductChangeField.PRICE || field === ProductChangeField.COST) {
    const numero = Number(valor);
    return Number.isFinite(numero) ? pesos.format(numero) : valor;
  }

  if (field === ProductChangeField.MIN_STOCK || field === ProductChangeField.IDEAL_STOCK) {
    const numero = Number(valor);
    return Number.isFinite(numero) ? formatQuantity(numero) : valor;
  }

  if (field === ProductChangeField.AVAILABILITY) {
    return valor === "true" ? "Disponible" : "No disponible";
  }

  return valor;
}

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

/** "Hoy" / "Ayer" / la fecha. Lo relativo primero: en un historial reciente lo
 *  que importa es hace cuánto, y "15/08" obliga a hacer la cuenta mental. */
function nombreDelDia(fecha: Date) {
  const hoy = new Date();
  const mismoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  if (mismoDia(fecha, hoy)) return "Hoy";

  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);
  if (mismoDia(fecha, ayer)) return "Ayer";

  return fecha.toLocaleDateString("es-AR", { day: "2-digit", month: "long" });
}

/** Los cambios ya vienen ordenados del más nuevo al más viejo, así que alcanza
 *  con cortar cuando cambia el día — no hace falta ordenar de nuevo. */
function agruparPorDia(cambios: CambioDeFicha[]) {
  const grupos: { dia: string; cambios: CambioDeFicha[] }[] = [];

  for (const cambio of cambios) {
    const dia = nombreDelDia(new Date(cambio.changedAt));
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.dia === dia) ultimo.cambios.push(cambio);
    else grupos.push({ dia, cambios: [cambio] });
  }

  return grupos;
}
