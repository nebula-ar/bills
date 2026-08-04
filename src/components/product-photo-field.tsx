"use client";

import { deleteProductImage, uploadProductImage } from "@/app/catalog/actions";
import { Check, Loader2, Plus, Sparkles, Trash2 } from "@/components/icons";
import { ProductPhotoAiSheet } from "@/components/product-photo-ai-sheet";
import { resizeImageForUpload } from "@/lib/image-resize";
import { useRef, useState, useTransition } from "react";

// Carga de la foto de un producto. Vive fuera del <form> de datos (los forms no
// se anidan) y sube por su cuenta: la foto se guarda apenas se elige, así el
// dueño la ve al instante en vez de tener que apretar "Guardar".
export function ProductPhotoField({
  productId,
  hasPhoto,
  version,
  productName,
  productDescription,
  aiEnabled,
}: {
  productId: string;
  hasPhoto: boolean;
  // Marca de tiempo de la última foto: va en la URL para saltear el caché.
  version: number | null;
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

  const src = photoVersion ? `/api/products/${productId}/image?v=${photoVersion}` : null;

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

      <div className="flex items-center gap-3">
        <button
          aria-label={src ? "Cambiar foto del producto" : aiEnabled ? "Agregar foto al producto" : "Elegir foto del producto"}
          className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 transition active:scale-95"
          disabled={isPending}
          onClick={() => src || !aiEnabled ? inputRef.current?.click() : openAi("origin")}
          type="button"
        >
          {src ? (
            // La sirve nuestra propia ruta, ya normalizada a 512px.
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" className="size-full object-cover" src={src} />
          ) : (
            <Plus className="size-6 text-slate-400" />
          )}
          {isPending ? (
            <span className="absolute inset-0 flex items-center justify-center bg-white/70">
              <Loader2 className="size-5 animate-spin text-blue-600" />
            </span>
          ) : null}
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-700">
            {src ? "Foto cargada" : aiEnabled ? "Sacá, elegí o generá una foto" : "Sacá o elegí una foto"}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Se ve en el listado y al vender. La guardamos chica para que el mostrador vaya rápido.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {src && aiEnabled ? (
              <button
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-blue-50 px-3 text-xs font-black text-blue-600 transition active:scale-95"
                disabled={isPending}
                onClick={() => openAi("enhance")}
                type="button"
              >
                <Sparkles className="size-4" />
                Mejorar con IA
              </button>
            ) : null}
            {src ? (
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
