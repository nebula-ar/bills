"use client";

import { deleteProductImage, uploadProductImage } from "@/app/catalog/actions";
import { Camera, Loader2, Sparkles, Trash2 } from "@/components/icons";
import { ProductPhotoAiSheet } from "@/components/product-photo-ai-sheet";
import { resizeImageForUpload } from "@/lib/image-resize";
import { productImageSrc } from "@/modules/catalog/product-image-src.logic";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

// La foto del producto, que ES la foto que se ve en el panel: no un campo
// "Foto" aparte con una segunda copia de la misma imagen abajo. Antes el panel
// mostraba la foto grande arriba Y este componente la volvía a dibujar en una
// caja 4:3 más abajo — la misma imagen dos veces en la misma pantalla.
//
// Acá la imagen que se muestra es el control: se toca y se cambia, con las
// acciones encima en vez de en una fila de botones aparte. El caller decide la
// forma (alto, esquinas) con `className` y qué mostrar cuando no hay ninguna
// foto con `fallback`, así el panel de escritorio y el de mobile usan la misma
// pieza con distinto tamaño en vez de tener cada uno la suya.
//
// Sube por su cuenta, sin esperar a "Guardar cambios": la foto se guarda apenas
// se elige así el dueño la ve al instante. Es la única parte del panel que no
// entra en el guardado en tanda, y es a propósito — no se tipea de a poco.
export function ProductPhotoField({
  productId,
  hasPhoto,
  version,
  catalogSlug,
  productName,
  productDescription,
  aiEnabled,
  className = "",
  fallback,
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
  // Forma del recuadro (alto, esquinas). La imagen siempre lo llena.
  className?: string;
  // Qué se ve cuando el producto no tiene foto propia ni del catálogo.
  fallback?: ReactNode;
}) {
  const [photoVersion, setPhotoVersion] = useState<number | null>(hasPhoto ? version : null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiInitialMode, setAiInitialMode] = useState<"origin" | "enhance">("origin");
  const [aiSession, setAiSession] = useState(0);

  // La misma decisión que toma el listado y el mostrador: propia si hay,
  // catálogo si no. Que "Quitar" sea solo para la propia sigue siendo cierto
  // —no se puede borrar un archivo compartido por todos los negocios— pero eso
  // es un motivo para esconder ese botón, no para esconder la foto.
  const src = productImageSrc({ id: productId, imageVersion: photoVersion, catalogSlug });
  const esPropia = photoVersion !== null;

  function pick(file: File | undefined) {
    if (!file) return;

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
        toast.error(result.error);
      }

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteProductImage(productId);
      if (result.ok) {
        setPhotoVersion(null);
      } else {
        toast.error(result.error);
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

  // Botones redondos sobre la foto: el mismo tratamiento que el "cerrar" del
  // panel de mobile (blanco translúcido con blur), para que se lean como
  // controles flotando sobre la imagen y no como parte de ella.
  const overlayButton =
    "flex size-11 items-center justify-center rounded-full bg-white/85 text-foreground shadow-sm backdrop-blur-sm transition active:scale-90 disabled:opacity-50";

  return (
    <div className={`relative overflow-hidden bg-slate-100 ${className}`}>
      {src ? (
        // La sirve nuestra propia ruta, ya normalizada a 512px.
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" className="size-full object-cover" src={src} />
      ) : (
        fallback
      )}

      {/* Con la foto del catálogo el dueño tiene que saber que no la subió él y
          que puede reemplazarla. Antes eso ocupaba dos párrafos; acá es un
          chip sobre la imagen, que dice lo mismo sin robarle lugar al resto. */}
      {!esPropia && src ? (
        <span className="absolute left-3 bottom-3 rounded-full bg-white/85 px-2.5 py-1 text-xs font-black text-slate-600 shadow-sm backdrop-blur-sm">
          Foto del rubro
        </span>
      ) : null}

      <div className="absolute bottom-3 right-3 flex items-center gap-2">
        {esPropia ? (
          <button
            aria-label="Quitar la foto"
            className={overlayButton}
            disabled={isPending}
            onClick={remove}
            type="button"
          >
            <Trash2 className="size-5 text-rose-600" />
          </button>
        ) : null}
        {aiEnabled ? (
          <button
            aria-label={esPropia ? "Mejorar la foto con IA" : "Generar una foto con IA"}
            className={overlayButton}
            disabled={isPending}
            onClick={() => openAi(esPropia ? "enhance" : "origin")}
            type="button"
          >
            <Sparkles className="size-5 text-primary" />
          </button>
        ) : null}
        <button
          aria-label={src ? "Cambiar la foto del producto" : "Agregar una foto al producto"}
          className={overlayButton}
          disabled={isPending}
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          <Camera className="size-5" />
        </button>
      </div>

      {isPending ? (
        <span className="absolute inset-0 flex items-center justify-center bg-white/70">
          <Loader2 className="size-6 animate-spin text-primary" />
        </span>
      ) : null}

      <input
        accept="image/*"
        className="hidden"
        // `capture` no se fuerza: en el celular deja elegir entre cámara y galería.
        onChange={(event) => pick(event.target.files?.[0])}
        ref={inputRef}
        type="file"
      />

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
