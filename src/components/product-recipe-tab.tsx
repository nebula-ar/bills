"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  getProductRecipe,
  removeRecipeItem,
  saveRecipeItem,
  type RecetaView,
} from "@/app/catalog/recipe-actions";
import { Loader2, Plus, Trash2 } from "@/components/icons";
import type { Unit } from "@/generated/prisma/client";
import { formatQuantity, unitShort } from "@/lib/quantity";

/**
 * Qué lleva este producto y cuánto sale hacerlo.
 *
 * Vivía en `/recetas`, una pantalla aparte que te hacía elegir en un modal el
 * producto que ya tenías abierto. La receta es DEL producto: se resuelve donde
 * está el producto (AGENTS.md).
 *
 * Se pide al servidor recién cuando se abre la pestaña, igual que Rentabilidad:
 * traer la receta de cada producto al pintar el catálogo sería pagar sesenta
 * consultas para algo que se mira de a uno.
 */

const pesos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export type InsumoDisponible = { id: string; name: string; unit: string };

export function ProductRecipeTab({
  productId,
  branchId,
  activa,
  insumos,
  precio,
}: {
  productId: string;
  branchId: string;
  /** Solo consulta cuando la pestaña está a la vista. */
  activa: boolean;
  /** Los insumos del negocio, para elegir qué agregar. */
  insumos: InsumoDisponible[];
  /** Precio de venta en la sucursal. null = sin precio cargado. */
  precio: number | null;
}) {
  const router = useRouter();
  const [receta, setReceta] = useState<RecetaView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, startCarga] = useTransition();
  const [guardando, startGuardado] = useTransition();
  const [agregando, setAgregando] = useState(false);
  const [nuevoInsumo, setNuevoInsumo] = useState("");
  const [nuevaCantidad, setNuevaCantidad] = useState("");
  const [recargas, setRecargas] = useState(0);

  useEffect(() => {
    if (!activa) return;

    let vigente = true;
    startCarga(async () => {
      const resultado = await getProductRecipe(productId, branchId);
      // Cambiar de producto rápido dispara dos pedidos: si contesta primero el
      // viejo, pintaría la receta de otro producto.
      if (!vigente) return;
      if (resultado.ok) {
        setReceta(resultado.receta);
        setError(null);
      } else {
        setError(resultado.error);
      }
    });

    return () => {
      vigente = false;
    };
  }, [activa, productId, branchId, recargas]);

  // Los insumos que todavía no están en la receta. Ofrecer uno que ya está
  // parece que se puede agregar dos veces, y no: el par producto+insumo es
  // único, así que el segundo pisaría al primero en silencio.
  const yaEnLaReceta = new Set((receta?.renglones ?? []).map((renglon) => renglon.ingredienteId));
  const disponibles = insumos.filter((insumo) => !yaEnLaReceta.has(insumo.id));
  const insumoElegido = insumos.find((insumo) => insumo.id === nuevoInsumo);

  function recargar() {
    setRecargas((n) => n + 1);
    // La lista de atrás muestra el costo del producto: sin esto se queda con el
    // número viejo aunque la receta ya cambió.
    router.refresh();
  }

  function agregar() {
    if (!nuevoInsumo) {
      setError("Elegí qué insumo lleva.");
      return;
    }

    setError(null);
    startGuardado(async () => {
      const resultado = await saveRecipeItem({
        productId,
        ingredientId: nuevoInsumo,
        cantidad: nuevaCantidad,
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      setNuevoInsumo("");
      setNuevaCantidad("");
      setAgregando(false);
      recargar();
    });
  }

  function quitar(recipeItemId: string) {
    setError(null);
    startGuardado(async () => {
      const resultado = await removeRecipeItem(recipeItemId);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      recargar();
    });
  }

  if (cargando && !receta) {
    return (
      <p className="flex items-center gap-2 py-8 text-sm font-semibold text-slate-500">
        <Loader2 className="size-4 animate-spin" />
        Buscando la receta…
      </p>
    );
  }

  const costo = receta?.costo ?? 0;
  const renglones = receta?.renglones ?? [];
  // Sin receta cargada el costo NO es cero: es desconocido. Un "$0" ahí daría
  // "margen 100%", que es la mentira más cara que puede decir esta pantalla
  // —hace creer que se gana todo lo que entra— justo en los productos a los que
  // todavía no se les cargó nada.
  const hayReceta = renglones.length > 0;
  const ganancia = hayReceta && precio !== null ? precio - costo : null;
  const margen = ganancia !== null && precio ? Math.round((ganancia / precio) * 100) : null;

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>
      ) : null}

      {/* Lo que se viene a saber: cuánto sale hacerlo y qué queda. */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-950/5">
        <Dato destacado etiqueta="Cuesta hacer uno" valor={hayReceta ? pesos.format(costo) : "Sin receta"} />
        <Dato etiqueta="Se vende a" valor={precio !== null ? pesos.format(precio) : "Sin precio"} />
        {hayReceta && ganancia !== null && margen !== null ? (
          <>
            <Dato etiqueta="Queda" tono={ganancia < 0 ? "malo" : "bueno"} valor={pesos.format(ganancia)} />
            <Dato etiqueta="Margen" tono={margen < 0 ? "malo" : "bueno"} valor={`${margen}%`} />
          </>
        ) : (
          <div className="col-span-2 bg-white px-4 py-3">
            <p className="text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500">Margen</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-500">
              {!hayReceta
                ? "Cargá la receta para saber qué te queda de cada uno."
                : "Ponele precio para saber qué te queda."}
            </p>
          </div>
        )}
      </div>

      {/* Un total al que le faltan insumos no es un total: decirlo evita que
          alguien fije el precio sobre media cuenta. */}
      {receta && receta.sinCostear > 0 ? (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
          {receta.sinCostear === 1
            ? "Un insumo no tiene costo cargado, así que lo de arriba es menos de lo que sale de verdad."
            : `${receta.sinCostear} insumos no tienen costo cargado, así que lo de arriba es menos de lo que sale de verdad.`}
        </p>
      ) : null}

      {receta?.alcanzaTotal !== null && receta?.alcanzaTotal !== undefined ? (
        <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
          Con lo que hay en stock alcanza para <strong className="text-slate-950">{receta.alcanzaTotal}</strong>.
        </p>
      ) : null}

      {renglones.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
          Todavía no cargaste qué lleva.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl ring-1 ring-slate-950/5">
          {renglones.map((renglon) => (
            <li className="flex items-center gap-3 bg-white px-4 py-3" key={renglon.id}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-slate-950">{renglon.nombre}</p>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">
                  {formatQuantity(renglon.cantidad, renglon.unit as Unit)} por unidad
                  {renglon.alcanzaPara !== null ? ` · alcanza para ${renglon.alcanzaPara}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                {renglon.sinCosto ? (
                  <span className="text-xs font-bold text-amber-700">sin costo</span>
                ) : (
                  <>
                    <p className="text-sm font-black text-slate-950">{pesos.format(renglon.costo)}</p>
                    <p className="text-[0.6875rem] font-semibold text-slate-500">{renglon.porcentaje}% del costo</p>
                  </>
                )}
              </div>
              <button
                aria-label={`Quitar ${renglon.nombre} de la receta`}
                className="shrink-0 rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                disabled={guardando}
                onClick={() => quitar(renglon.id)}
                type="button"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* El alta se abre cuando se la pide: un formulario permanente abajo de la
          receta compite con lo que se vino a mirar. */}
      {agregando ? (
        <div className="grid gap-3 rounded-2xl border border-slate-200 p-4">
          <label className="grid gap-1.5 text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500">
            Insumo
            <select
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none focus:border-primary/40 focus:bg-white"
              onChange={(evento) => setNuevoInsumo(evento.target.value)}
              value={nuevoInsumo}
            >
              <option value="">Elegí un insumo</option>
              {disponibles.map((insumo) => (
                <option key={insumo.id} value={insumo.id}>
                  {insumo.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500">
            {/* La unidad se nombra acá, en el label del campo: "cuánto lleva" a
                secas obliga a acordarse de si la harina se cargó en kilos o en
                gramos, y ese olvido no falla, guarda otra cosa. */}
            {insumoElegido
              ? `Cuánto lleva, en ${unitShort(insumoElegido.unit as Unit)}`
              : "Cuánto lleva por unidad"}
            <input
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none focus:border-primary/40 focus:bg-white"
              inputMode="decimal"
              onChange={(evento) => setNuevaCantidad(evento.target.value)}
              placeholder="Ej: 0,12"
              value={nuevaCantidad}
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              className="rounded-2xl px-4 py-2.5 text-sm font-black text-slate-500 transition hover:bg-slate-50"
              onClick={() => {
                setAgregando(false);
                setError(null);
              }}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-black text-white transition active:scale-95 disabled:opacity-60"
              disabled={guardando}
              onClick={agregar}
              type="button"
            >
              {guardando ? <Loader2 className="size-4 animate-spin" /> : null}
              Agregar
            </button>
          </div>
        </div>
      ) : (
        <button
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm font-black text-slate-600 transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
          disabled={disponibles.length === 0}
          onClick={() => setAgregando(true)}
          type="button"
        >
          <Plus className="size-4" />
          {disponibles.length === 0 ? "No quedan insumos para agregar" : "Agregar un insumo"}
        </button>
      )}
    </div>
  );
}

function Dato({
  etiqueta,
  valor,
  destacado,
  tono,
}: {
  etiqueta: string;
  valor: string;
  destacado?: boolean;
  tono?: "bueno" | "malo";
}) {
  return (
    <div className="bg-white px-4 py-3">
      <p className="text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500">{etiqueta}</p>
      <p
        className={`mt-0.5 font-black ${destacado ? "text-xl" : "text-lg"} ${
          tono === "malo" ? "text-rose-600" : tono === "bueno" ? "text-emerald-700" : "text-slate-950"
        }`}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {valor}
      </p>
    </div>
  );
}
