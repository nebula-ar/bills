"use client";

import { deleteProductImage, uploadProductImage } from "@/app/catalog/actions";
import { Check, Loader2, Plus, Sparkles, Trash2 } from "@/components/icons";
import { ProductPhotoAiSheet } from "@/components/product-photo-ai-sheet";
import { resizeImageForUpload } from "@/lib/image-resize";
import { productImageSrc } from "@/modules/catalog/product-image-src.logic";
import { useRef, useState, useTransition } from "react";

// Carga de la foto de un producto. Vive fuera del <form> de datos (los forms no
// se anidan) y sube por su cuenta: la foto se guarda apenas se elige, así el
// dueño la ve al instante en vez de tener que apretar "Guardar".
export function ProductPhotoField({
  productId,
  hasPhoto,
  version,
  catalogSlug,
  productName,
  productDescription,
  aiEnabled,
}: {
  productId: string;
  hasPhoto: boolean;
  // Marca de tiempo de la última foto: va en la URL para saltear el caché.
  version: number | null;
  // Qué producto del catálogo de rubro es. Si el negocio no subió foto propia,
  // esta es la que se ve en el listado y al vender.
  catalogSlug: string | null;
  productName: string;
  productDescription: string | null;
  aiEnabled: boolean;
}) {
  const [photoVersion, setPhotoVersion] = useState<number | null>(hasPhoto ? version : null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiInitialMode, setAiInitialMode] = useState<"origin" | "enhance">("origin");
  const [aiSession, setAiSession] = useState(0);

  // La misma decisión que toma el listado y el mostrador: propia si hay,
  // catálogo si no. Antes acá se miraba SOLO la propia, así que un producto con
  // foto del catálogo abría el editor en blanco y parecía que se había perdido.
  //
  // Que "Quitar" sea solo para la propia sigue siendo cierto —no se puede borrar
  // un archivo compartido por todos los negocios— pero eso es un motivo para
  // esconder el botón, no para esconder la foto.
  const src = productImageSrc({ id: productId, imageVersion: photoVersion, catalogSlug });
  const esPropia = photoVersion !== null;

  function pick(file: File | undefined) {
    if (!file) return;
    setError(null);

    startTransition(async () => {
      // Se achica acá para que el viaje sea corto; el servidor igual la reprocesa.
      const resized = await resizeImageForUpload(file);
      const formData = new FormData();
      formData.set("productId", productId);
      formData.set("file", resized);

      const result = await uploadProductImage(formData);

      if (result.ok) {
        setPhotoVersion(result.version);
      } else {
        setError(result.error);
      }

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await deleteProductImage(productId);
      if (result.ok) {
        setPhotoVersion(null);
      } else {
        setError(result.error);
      }
    });
  }

  function openAi(mode: "origin" | "enhance") {
    setAiInitialMode(mode);
    setAiSession((value) => value + 1);
    setAiOpen(true);
  }

  function usePhoto() {
    // Tiene que ocurrir dentro del mismo gesto: iOS bloquea el selector de
    // archivos si se difiere con timeout después del tap.
    inputRef.current?.click();
    setAiOpen(false);
  }

  return (
    <div className="grid gap-2">
      <span className="text-xs font-black uppercase tracking-wide text-slate-500">Foto</span>

      {/* Apilado y no en fila: en la ficha la foto es la identidad del producto
          —es como lo reconoce el que vende— así que ocupa el ancho de su
          columna en vez de ser una miniatura al costado del texto. */}
      <div className="flex flex-col gap-2.5">
        <button
          aria-label={src ? "Cambiar foto del producto" : aiEnabled ? "Agregar foto al producto" : "Elegir foto del producto"}
          className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 transition active:scale-[0.99]"
          disabled={isPending}
          onClick={() => src || !aiEnabled ? inputRef.current?.click() : openAi("origin")}
          type="button"
        >
          {src ? (
            // La sirve nuestra propia ruta, ya normalizada a 512px.
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" className="size-full object-cover" src={src} />
          ) : (
            <Plus className="size-7 text-slate-400" />
          )}
          {isPending ? (
            <span className="absolute inset-0 flex items-center justify-center bg-white/70">
              <Loader2 className="size-5 animate-spin text-primary" />
            </span>
          ) : null}
        </button>

        <div className="min-w-0 flex-1">
          {/* Se distingue de dónde salió: con la del catálogo el dueño tiene que
              saber que puede reemplazarla por la suya, y que no la subió él. */}
          {/* Tres estados y no dos: propia, del catálogo, o ninguna. La del
              catálogo existía antes de este merge y el editor la mostraba en
              blanco; la generación con IA de master se suma como una forma más
              de conseguir la propia. */}
          <p className="text-sm font-bold text-slate-700">
            {esPropia
              ? "Foto cargada"
              : src
                ? "Foto del catálogo"
                : aiEnabled
                  ? "Sacá, elegí o generá una foto"
                  : "Sacá o elegí una foto"}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {!esPropia && src
              ? "Es la genérica del rubro. Sacale una foto a la tuya y reemplazala."
              : "Se ve en el listado y al vender. La guardamos chica para que el mostrador vaya rápido."}
          </p>
          {/* Las dos acciones dependen de si la foto es PROPIA, que es la
              distinción que la del catálogo hizo necesaria:
              - "Mejorar" retoca una foto existente, así que solo tiene sentido
                sobre la del negocio. Sobre la genérica del rubro se genera una
                nueva, no se retoca una ajena.
              - "Quitar" tampoco: no se puede borrar un archivo que comparten
                todos los negocios. */}
          <div className="mt-2 flex flex-wrap gap-2">
            {aiEnabled ? (
              <button
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-primary/10 px-3 text-xs font-black text-primary transition active:scale-95"
                disabled={isPending}
                onClick={() => openAi(esPropia ? "enhance" : "origin")}
                type="button"
              >
                <Sparkles className="size-4" />
                {esPropia ? "Mejorar con IA" : "Generar con IA"}
              </button>
            ) : null}
            {esPropia ? (
              <button
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 text-xs font-bold text-rose-600 transition active:scale-95"
                disabled={isPending}
                onClick={remove}
                type="button"
              >
                <Trash2 className="size-3.5" />
                Quitar
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <input
        accept="image/*"
        className="hidden"
        // `capture` no se fuerza: en el celular deja elegir entre cámara y galería.
        onChange={(event) => pick(event.target.files?.[0])}
        ref={inputRef}
        type="file"
      />

      {error ? <p className="text-xs font-bold text-rose-600">{error}</p> : null}
      {!error && photoVersion && !isPending ? (
        <p className="flex items-center gap-1 text-xs font-bold text-emerald-600">
          <Check className="size-3.5" />
          Guardada
        </p>
      ) : null}

      {aiEnabled ? (
        <ProductPhotoAiSheet
          initialMode={aiInitialMode}
          key={aiSession}
          onClose={() => setAiOpen(false)}
          onSaved={setPhotoVersion}
          onUsePhoto={usePhoto}
          open={aiOpen}
          productDescription={productDescription}
          productId={productId}
          productName={productName}
          sourceSrc={src}
        />
      ) : null}
    </div>
  );
}
