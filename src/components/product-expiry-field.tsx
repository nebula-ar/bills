"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { getProductExpiry, setProductExpiry } from "@/app/catalog/stock-actions";
import { Check, Loader2 } from "@/components/icons";
import { estadoDeVencimiento, textoDeVencimiento } from "@/modules/stock/vencimientos";

/**
 * Cuándo se vence lo que hay en esta sucursal.
 *
 * Va por SUCURSAL y no por producto: dos bolsas del mismo insumo vencen
 * distinto, y la de Centro no es la de Palermo. Por eso vive en Inventario,
 * pegado a la existencia que califica, y cambia cuando se cambia de sucursal.
 *
 * Guarda solo, con su propio botón: está dentro de la ficha pero fuera del
 * <form> grande —un form anidado no es HTML válido— y además es una escritura
 * sobre el stock, no sobre el producto.
 */
export function ProductExpiryField({ productId, branchId }: { productId: string; branchId: string }) {
  const router = useRouter();
  const [valor, setValor] = useState("");
  const [guardado, setGuardado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [cargando, startCarga] = useTransition();
  const [guardando, startGuardado] = useTransition();

  useEffect(() => {
    let vigente = true;
    setListo(false);
    startCarga(async () => {
      const resultado = await getProductExpiry(productId, branchId);
      // Cambiar de sucursal rápido dispara dos pedidos: si contesta primero el
      // viejo, pintaría el vencimiento de la otra sucursal.
      if (!vigente) return;
      if (resultado.ok) {
        setValor(resultado.expiresAt ?? "");
        setGuardado(resultado.expiresAt);
        setError(null);
      } else {
        setError(resultado.error);
      }
      setListo(true);
    });

    return () => {
      vigente = false;
    };
  }, [productId, branchId]);

  function guardar() {
    setError(null);
    startGuardado(async () => {
      const resultado = await setProductExpiry({ productId, branchId, expiresAt: valor });
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setGuardado(resultado.expiresAt);
      // La columna "Vence" de la lista de atrás sale del árbol del servidor:
      // sin esto se queda con la fecha vieja aunque la base ya esté escrita
      // (AGENTS.md — una acción que muta y se queda en la misma ruta devuelve
      // resultado, y el cliente refresca).
      router.refresh();
    });
  }

  const cambiado = listo && valor !== (guardado ?? "");
  // El aviso sale del mismo dominio que usaba la pantalla vieja, así que
  // "vence pronto" significa lo mismo en los dos lados.
  const estado = guardado ? estadoDeVencimiento(new Date(`${guardado}T12:00:00Z`), new Date()) : "sin-fecha";

  return (
    <div className="grid gap-1.5">
      <span className="text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500">
        Vence (en esta sucursal)
      </span>
      <div className="flex items-center gap-2">
        <input
          className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white"
          disabled={cargando && !listo}
          onChange={(evento) => setValor(evento.target.value)}
          type="date"
          value={valor}
        />
        {/* El botón aparece recién cuando hay algo distinto que guardar: uno
            permanente al lado de un campo que no se tocó invita a apretarlo
            para "confirmar" algo que ya está. */}
        {cambiado ? (
          <button
            className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-white transition active:scale-95 disabled:opacity-60"
            disabled={guardando}
            onClick={guardar}
            type="button"
          >
            {guardando ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Guardar
          </button>
        ) : null}
      </div>

      {/* Solo se avisa lo que hay que resolver: "ok" y "sin fecha" no son
          noticias, y un cartel permanente deja de leerse. */}
      {!cambiado && estado !== "ok" && estado !== "sin-fecha" ? (
        <p
          className={`text-xs font-bold ${estado === "vencido" ? "text-rose-600" : "text-amber-700"}`}
        >
          {textoDeVencimiento(estado)}
        </p>
      ) : null}

      {error ? <p className="text-xs font-bold text-rose-600">{error}</p> : null}

      {/* Vaciar el campo lo borra: cargar una fecha por error y no poder sacarla
          es peor que no tener el campo. */}
      <p className="text-[0.6875rem] text-slate-500">Dejalo vacío para borrarlo.</p>
    </div>
  );
}
