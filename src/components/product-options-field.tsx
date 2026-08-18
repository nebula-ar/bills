"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  getProductModifierGroups,
  toggleProductModifierGroup,
  type GrupoDeOpciones,
} from "@/app/catalog/modifier-actions";
import { Loader2 } from "@/components/icons";

/**
 * Qué opciones se le ofrecen a este producto.
 *
 * Los grupos se definen en `/opciones` —son un catálogo compartido, como las
 * categorías— pero elegir cuáles lleva ESTE producto es del producto. Antes
 * había que ir a la otra pantalla, encontrar el grupo y tildarlo en una lista
 * de todos los productos del negocio.
 *
 * Cada tilde guarda sola: es una sola relación, y juntarla con "Guardar
 * cambios" haría que un tilde parezca aplicado antes de estarlo.
 */
export function ProductOptionsField({ productId }: { productId: string }) {
  const router = useRouter();
  const [grupos, setGrupos] = useState<GrupoDeOpciones[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardandoId, setGuardandoId] = useState<string | null>(null);
  const [cargando, startCarga] = useTransition();
  const [, startGuardado] = useTransition();

  useEffect(() => {
    let vigente = true;
    startCarga(async () => {
      const resultado = await getProductModifierGroups(productId);
      if (!vigente) return;
      if (resultado.ok) {
        setGrupos(resultado.grupos);
        setError(null);
      } else {
        setError(resultado.error);
      }
    });

    return () => {
      vigente = false;
    };
  }, [productId]);

  function alternar(grupo: GrupoDeOpciones) {
    setError(null);
    setGuardandoId(grupo.id);

    // Se pinta antes de que conteste el servidor y se revierte si falla: un
    // tilde que tarda medio segundo en moverse se toca dos veces.
    setGrupos((actuales) =>
      (actuales ?? []).map((item) => (item.id === grupo.id ? { ...item, activo: !item.activo } : item)),
    );

    startGuardado(async () => {
      const resultado = await toggleProductModifierGroup({
        productId,
        groupId: grupo.id,
        incluir: !grupo.activo,
      });

      setGuardandoId(null);

      if (!resultado.ok) {
        setGrupos((actuales) =>
          (actuales ?? []).map((item) => (item.id === grupo.id ? { ...item, activo: grupo.activo } : item)),
        );
        setError(resultado.error);
        return;
      }

      router.refresh();
    });
  }

  if (cargando && !grupos) {
    return (
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-500">
        <Loader2 className="size-4 animate-spin" />
        Buscando las opciones…
      </p>
    );
  }

  if (grupos && grupos.length === 0) {
    return (
      <div className="grid gap-1.5">
        <span className="text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500">Opciones</span>
        <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
          Todavía no creaste ningún grupo de opciones. Se arman en Opciones y después se eligen acá.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-1.5">
      <span className="text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500">Opciones</span>

      {error ? <p className="text-xs font-bold text-rose-600">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        {(grupos ?? []).map((grupo) => (
          <button
            aria-pressed={grupo.activo}
            className={`rounded-full border px-3.5 py-2 text-left text-xs font-black transition active:scale-95 ${
              grupo.activo
                ? "border-primary bg-primary/10 text-primary"
                : "border-slate-200 bg-white text-slate-600 hover:border-primary/40"
            }`}
            disabled={guardandoId === grupo.id}
            key={grupo.id}
            onClick={() => alternar(grupo)}
            type="button"
          >
            {grupo.name}
            <span className="ml-1.5 font-bold text-slate-400">
              {grupo.opciones} {grupo.opciones === 1 ? "opción" : "opciones"}
              {grupo.required ? " · obligatorio" : ""}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
