"use client";

import { applyProductStockAction, type StockOp } from "@/app/catalog/stock-actions";
import { Check, Loader2, Package, X } from "@/components/icons";
import type { Unit } from "@/generated/prisma/enums";
import { formatQuantity, parseQuantityInput, sanitizeQuantityInput, unitShort } from "@/lib/quantity";
import { resultadoDeOperacion } from "@/modules/stock/stock-operation.logic";
import { useState, useTransition } from "react";
import { toast } from "sonner";

// La existencia del producto, dentro de su propia ficha.
//
// Antes había que salir a la pantalla de Stock, buscar el producto en una lista
// larga y recién ahí operar. Para quien está cargando su emprendimiento por
// primera vez eso es una pared: acá el producto ya está elegido y lo único que
// queda es escribir el número.

/**
 * Las tres operaciones, dichas como lo que le pasó al negocio y no como lo que
 * le pasa a la base.
 *
 * `verbo` completa la frase "va a quedar en…" y `pregunta` es lo que se
 * responde escribiendo. Antes los botones decían "Conté / Llegó / Se perdió" y
 * había que adivinar cuál sumaba y cuál fijaba: escribir 9 en la primera deja
 * 9, en la segunda deja 20 y en la tercera deja 2.
 */
const OPS: {
  op: StockOp;
  boton: string;
  pregunta: string;
  ayuda: string;
  /** El efecto, en dos palabras, para mostrarlo ANTES de elegir. */
  efecto: string;
  /** El signo de la cuenta: es lo que distingue las tres de un vistazo. */
  signo: "+" | "=" | "−";
  placeholder: string;
}[] = [
  {
    op: "receive",
    boton: "Llegó mercadería",
    pregunta: "¿Cuánto llegó?",
    ayuda: "Se suma a lo que ya había.",
    efecto: "se suma",
    signo: "+",
    placeholder: "Lo que entró",
  },
  {
    op: "adjust",
    boton: "Conté y hay otra cantidad",
    pregunta: "¿Cuánto hay de verdad?",
    ayuda: "Lo que escribas reemplaza la existencia. No se suma.",
    efecto: "reemplaza el total",
    signo: "=",
    placeholder: "Lo que contaste",
  },
  {
    op: "loss",
    boton: "Se perdió o rompió",
    pregunta: "¿Cuánto se perdió?",
    ayuda: "Se descuenta de lo que había.",
    efecto: "se descuenta",
    signo: "−",
    placeholder: "Lo que se perdió",
  },
];

export function ProductStockPanel({
  productId,
  branchId,
  branchName,
  unit,
  quantity,
  minStock,
  onChanged,
  showSummary = true,
}: {
  productId: string;
  branchId: string;
  branchName: string;
  unit: Unit;
  // Existencia actual en milésimas. null = el producto no lleva control.
  quantity: number | null;
  minStock: number | null;
  // Recibe la existencia que quedó, para que el caller pueda sincronizar lo que
  // ya venía mostrando en vez de quedarse con un número viejo.
  onChanged?: (quantity: number) => void;
  // Apagar cuando el caller YA muestra la existencia arriba (el panel de
  // producto la tiene en su stepper): repetir "Quedan 19" abajo del 19 que se
  // acaba de leer no agrega nada y hace parecer que son dos cosas distintas.
  showSummary?: boolean;
}) {
  const [op, setOp] = useState<StockOp | null>(null);
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [displayQuantity, setDisplayQuantity] = useState(quantity);
  const [isPending, startTransition] = useTransition();

  if (displayQuantity === null) {
    return null;
  }

  const low = minStock !== null && displayQuantity <= minStock;
  const active = OPS.find((item) => item.op === op) ?? null;

  // Contar cero es legítimo ("se acabó"); recibir o perder cero, no.
  const escrito = parseQuantityInput(value, unit);
  const cantidad = escrito ?? (op === "adjust" && value.trim() === "0" ? 0 : null);
  const vistaPrevia = op && cantidad !== null ? resultadoDeOperacion(op, displayQuantity, cantidad) : null;

  // El filtro del input evita casi todo lo inválido, pero quedan dos cosas que
  // solo se pueden decir con palabras: escribir cero donde no corresponde y
  // dejar el separador colgando ("1,"). Un botón apagado sin explicación deja
  // al usuario tocándolo sin entender.
  const problema =
    value.trim() === "" || cantidad !== null
      ? null
      : op === "adjust"
        ? "Escribí cuánto contaste."
        : "Tiene que ser un número mayor que cero.";

  function abrir(next: StockOp) {
    setOp(next === op ? null : next);
    setValue("");
    setReason("");
  }

  function cerrar() {
    setOp(null);
    setValue("");
    setReason("");
  }

  function submit() {
    if (!op) return;

    if (cantidad === null) {
      toast.error("Escribí una cantidad válida.");
      return;
    }

    startTransition(async () => {
      const result = await applyProductStockAction({ op, productId, branchId, quantity: cantidad, reason });

      if (result.ok) {
        toast.success("Stock actualizado.");
        // El número nuevo lo devuelve la acción y se pinta en el acto, en vez de
        // recargar la pantalla entera con `router.refresh()`. Viene de master y
        // es mejor: acá el panel puede estar dentro de un modal, y refrescar la
        // ruta lo cerraría.
        setDisplayQuantity(result.quantity);
        cerrar();
        onChanged?.(result.quantity);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className={`overflow-hidden rounded-2xl ${showSummary ? "bg-slate-50 ring-1 ring-slate-950/5" : ""}`}>
      {/* Qué hay, dicho con todas las letras. "11 un" solo no dice si es lo que
          queda, lo que entró o el mínimo. Se omite cuando el caller ya lo
          muestra arriba (ver `showSummary`). */}
      {showSummary ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <Package className={`size-6 ${low ? "text-amber-600" : "text-slate-400"}`} />
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                Quedan en {branchName}
              </p>
              <p className={`font-display text-2xl font-black ${low ? "text-amber-600" : "text-slate-950"}`}>
                {formatQuantity(displayQuantity, unit)}
              </p>
            </div>
          </div>

          {low ? (
            <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-black text-amber-700">
              Hay que reponer
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Un botón por cosa que pasó en el negocio, no por operación de sistema.
          Apilados y con el texto entero: en fila y abreviados no se distinguía
          cuál sumaba y cuál reemplazaba. */}
      {!active ? (
        <div className={`grid gap-1.5 ${showSummary ? "border-t border-slate-200/70 p-2" : ""}`}>
          {OPS.map((item) => (
            <button
              className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 text-left ring-1 ring-slate-200 transition hover:ring-slate-300 active:scale-[0.99]"
              key={item.op}
              onClick={() => abrir(item.op)}
              type="button"
            >
              {/* El SIGNO en vez de una flecha. La flecha decía "te lleva a otro
                  lado" —y no lleva a ningún lado, abre un campo acá mismo— y
                  además era la misma en las tres, justo donde había que
                  distinguirlas. El signo muestra la cuenta: suma, reemplaza o
                  resta. Se entiende sin leer. */}
              <span
                aria-hidden="true"
                className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-base font-black ${
                  item.signo === "+"
                    ? "bg-emerald-50 text-emerald-700"
                    : item.signo === "−"
                      ? "bg-rose-50 text-rose-700"
                      : "bg-slate-100 text-slate-600"
                }`}
              >
                {item.signo}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-black text-slate-800">{item.boton}</span>
                {/* El efecto, ANTES de elegir. Estaba escrito pero solo se veía
                    DESPUÉS de tocar el botón: justo la información que sirve
                    para decidir cuál tocar aparecía cuando ya habías decidido. */}
                <span className="block text-xs text-slate-500">{item.efecto}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className={`p-3 duration-200 animate-in fade-in slide-in-from-top-1 ${showSummary ? "border-t border-slate-200/70" : ""}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-black text-slate-950">{active.pregunta}</p>
              <p className="mt-0.5 text-xs text-slate-500">{active.ayuda}</p>
            </div>
            <button
              aria-label="Cancelar"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-slate-400 ring-1 ring-slate-200 transition active:scale-90"
              onClick={cerrar}
              type="button"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* El campo filtra al escribir: lo que no puede ser una cantidad no
              llega a entrar. Escribir "diez" y ver el botón apagado sin más es
              lo que hacía sentir que la pantalla no responde. */}
          <label
            className={`mt-2.5 flex items-center rounded-xl border bg-white px-3.5 ${
              problema ? "border-amber-300" : "border-slate-200"
            }`}
          >
            <input
              aria-label={active.pregunta}
              autoFocus
              className="w-full min-w-0 bg-transparent py-3 text-lg font-black text-slate-950 outline-none"
              inputMode="decimal"
              onChange={(event) => setValue(sanitizeQuantityInput(event.target.value, unit))}
              placeholder={active.placeholder}
              value={value}
            />
            <span className="shrink-0 text-sm font-black text-slate-400">{unitShort(unit)}</span>
          </label>

          {problema ? <p className="mt-1.5 text-xs font-bold text-amber-700">{problema}</p> : null}

          {/* LA vista previa. Es lo que hace entendible la pantalla: no hay que
              saber si la operación suma o reemplaza, se ve en qué termina. */}
          {vistaPrevia ? (
            <div
              className={`mt-2.5 flex items-baseline justify-between gap-2 rounded-xl px-3.5 py-3 ${
                vistaPrevia.cambio < 0 ? "bg-amber-50" : "bg-emerald-50"
              }`}
            >
              <span
                className={`text-xs font-black uppercase tracking-wide ${
                  vistaPrevia.cambio < 0 ? "text-amber-700" : "text-emerald-700"
                }`}
              >
                Va a quedar en
              </span>
              <span className="text-right">
                <span
                  className={`font-display block text-xl font-black ${
                    vistaPrevia.cambio < 0 ? "text-amber-700" : "text-emerald-700"
                  }`}
                >
                  {formatQuantity(vistaPrevia.queda, unit)}
                </span>
                <span className="block text-xs font-bold text-slate-500">
                  {vistaPrevia.cambio === 0
                    ? "sin cambios"
                    : `${vistaPrevia.cambio > 0 ? "+" : "−"}${formatQuantity(Math.abs(vistaPrevia.cambio), unit)} sobre ${formatQuantity(displayQuantity, unit)}`}
                </span>
              </span>
            </div>
          ) : null}

          {/* Perder más de lo que hay no se rechaza: se avisa que va a cortar en
              cero, para que el faltante no quede escondido. */}
          {vistaPrevia?.recortado ? (
            <p className="mt-2 rounded-xl bg-amber-100 px-3.5 py-2.5 text-xs font-bold text-amber-800">
              Estás perdiendo más de lo que figuraba. La existencia va a quedar en cero.
            </p>
          ) : null}

          {op !== "receive" ? (
            <input
              aria-label="Motivo"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-950 outline-none"
              onChange={(event) => setReason(event.target.value)}
              placeholder={op === "loss" ? "Motivo (se venció, se rompió…)" : "Motivo (conteo de fin de mes…)"}
              value={reason}
            />
          ) : null}

          <button
            className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-white transition active:scale-[0.99] disabled:bg-slate-200 disabled:text-slate-400"
            disabled={isPending || cantidad === null}
            onClick={submit}
            type="button"
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {/* El botón repite el resultado: es lo último que se lee antes de
                tocar, y así no hay que subir la vista para confirmar. */}
            {vistaPrevia ? `Dejar en ${formatQuantity(vistaPrevia.queda, unit)}` : "Guardar"}
          </button>
        </div>
      )}
    </div>
  );
}
