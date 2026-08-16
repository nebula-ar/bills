"use client";

import { deleteProductImage, uploadProductImage } from "@/app/catalog/actions";
import { Camera, Check, Loader2, Plus, Sparkles, Trash2 } from "@/components/icons";
import { ProductPhotoAiSheet } from "@/components/product-photo-ai-sheet";
import { resizeImageForUpload } from "@/lib/image-resize";
import { CatalogUploader } from "@/components/catalog-uploader";
import { productImageSrc } from "@/modules/catalog/product-image-src.logic";
import type { UploaderComponent } from "@syncfusion/ej2-react-inputs";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

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
  compact = false,
  onPendiente,
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
  /**
   * Modo miniatura, para vivir en el encabezado de la ficha.
   *
   * La foto ya es la identidad del producto y se muestra arriba; tenerla otra
   * vez adentro del formulario como tarjeta grande era la misma imagen dos
   * veces, ocupando el lugar que se lee primero para algo que se cambia una vez.
   * Acá la miniatura ES el control.
   */
  compact?: boolean;
  /**
   * Diferido: elegir o quitar la foto NO va al servidor. Se muestra la vista
   * previa y se avisa al padre, que la aplica al guardar el formulario.
   *
   * Sin esto la foto se guardaba sola mientras el resto de la ficha espera el
   * botón, y "Cancelar" no la deshacía: quedaba una foto que el usuario nunca
   * confirmó. Un formulario con botón de guardar tiene que guardar TODO ahí.
   */
  onPendiente?: (cambio: { archivo: File | null; quitar: boolean }) => void;
}) {
  const [photoVersion, setPhotoVersion] = useState<number | null>(hasPhoto ? version : null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // El Uploader de EJ2 vive oculto: la tarjeta visible dispara su selector (la
  // misma mecánica que usaba el input de archivo escondido, pero con la
  // validación de tipos y el evento `selected` del Uploader).
  const uploaderRef = useRef<UploaderComponent>(null);
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
  // Lo elegido y todavía no guardado. La vista previa es un objectURL local, así
  // que se ve al instante sin haber tocado el servidor.
  const [previaLocal, setPreviaLocal] = useState<string | null>(null);
  const [quitarPendiente, setQuitarPendiente] = useState(false);

  // El aviso al padre vive en un ref, no en las dependencias de `pick`.
  // `pick` tiene que mantener su identidad —el CatalogUploader está memoizado y
  // si cambia se re-renderiza y pierde el input (NEBU-48)—, pero igual tiene que
  // llamar al callback ACTUAL, no al que existía en el primer render.
  const avisarPendiente = useRef(onPendiente);
  useEffect(() => {
    avisarPendiente.current = onPendiente;
  }, [onPendiente]);

  // Soltar el objectURL al desmontar: si no, se filtra memoria por cada foto
  // que se elige y se descarta.
  useEffect(() => () => {
    if (previaLocal) URL.revokeObjectURL(previaLocal);
  }, [previaLocal]);

  const guardada = productImageSrc({ id: productId, imageVersion: photoVersion, catalogSlug });
  // Lo pendiente pisa lo guardado: es lo que el usuario acaba de elegir.
  const src = previaLocal ?? (quitarPendiente ? null : guardada);
  const esPropia = previaLocal !== null || (!quitarPendiente && photoVersion !== null);

  // Abre el selector de archivos del Uploader.
  //
  // `element` ES el <input type=file>: EJ2 se inicializa SOBRE el input, no lo
  // envuelve. Buscar adentro con `querySelector` devolvía null y el click nunca
  // salía — el botón parecía no andar. Se contemplan los dos casos por si una
  // versión futura cambia de estrategia, y se cae al DOM si el ref no llegó.
  function openPicker() {
    const el = uploaderRef.current?.element as HTMLElement | undefined;
    const input =
      el instanceof HTMLInputElement
        ? el
        : el?.querySelector<HTMLInputElement>("input[type=file]") ??
          document.querySelector<HTMLInputElement>(".e-catalog-uploader input[type=file]");

    input?.click();
  }

  // Estable a propósito (useCallback con productId, que no cambia dentro de la
  // ficha): el CatalogUploader está memoizado y un cambio de identidad lo
  // re-renderizaría y perdería el input (NEBU-48).
  const pick = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      setError(null);

      startTransition(async () => {
        let resized: File;
        try {
          // Se achica acá para que el viaje sea corto; el servidor igual la reprocesa.
          resized = await resizeImageForUpload(file);
        } catch {
          // HEIC en un dispositivo que no lo decodifica: el servidor tampoco
          // (sharp prebuilt no lo soporta), así que se avisa acá con un mensaje
          // claro en vez de mandarlo y recibir un rechazo confuso.
          setError("Esa foto es HEIC y este dispositivo no puede procesarla. Convertila a JPG o PNG, o sacala con otra app.");
          return;
        }
        // Diferido: no se sube nada todavía. Se muestra lo elegido y se avisa
        // al padre, que la manda al guardar junto con el resto de la ficha.
        if (avisarPendiente.current) {
          setPreviaLocal((anterior) => {
            if (anterior) URL.revokeObjectURL(anterior);
            return URL.createObjectURL(resized);
          });
          setQuitarPendiente(false);
          avisarPendiente.current({ archivo: resized, quitar: false });
          uploaderRef.current?.clearAll();
          return;
        }

        const formData = new FormData();
        formData.set("productId", productId);
        formData.set("file", resized);

        const result = await uploadProductImage(formData);

        if (result.ok) {
          setPhotoVersion(result.version);
        } else {
          setError(result.error);
        }

        // Vacía la lista interna del Uploader para que la próxima selección sea
        // un archivo nuevo y no un append.
        uploaderRef.current?.clearAll();
      });
    },
    [productId],
  );

  function remove() {
    setError(null);

    if (onPendiente) {
      setPreviaLocal((anterior) => {
        if (anterior) URL.revokeObjectURL(anterior);
        return null;
      });
      setQuitarPendiente(true);
      onPendiente({ archivo: null, quitar: true });
      return;
    }

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
    openPicker();
    setAiOpen(false);
  }

  if (compact) {
    return (
      <div className="flex shrink-0 flex-col items-center gap-1.5">
        <button
          aria-label={src ? "Cambiar foto del producto" : "Agregar foto al producto"}
          className="group relative size-20 shrink-0 overflow-hidden rounded-2xl bg-slate-50 ring-1 ring-slate-950/5 transition active:scale-95"
          disabled={isPending}
          onClick={() => (src || !aiEnabled ? openPicker() : openAi("origin"))}
          type="button"
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" className="size-full object-cover" src={src} />
          ) : (
            <span className="flex size-full items-center justify-center text-slate-400">
              <Plus className="size-6" />
            </span>
          )}
          {/* La invitación aparece al apuntar: una miniatura sola no dice que
              se puede tocar, y un cartel permanente encima de la foto tapa
              justo lo que sirve para reconocer el producto. */}
          <span className="absolute inset-0 flex items-center justify-center bg-slate-950/45 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
            <Camera className="size-5 text-white" />
          </span>
          {isPending ? (
            <span className="absolute inset-0 flex items-center justify-center bg-white/70">
              <Loader2 className="size-5 animate-spin text-primary" />
            </span>
          ) : null}
        </button>

        {/* Las dos acciones que no son "cambiar", en chico y solo cuando
            aplican: generar con IA sirve siempre, quitar solo sobre la foto
            propia —la del catálogo la comparten todos los negocios—. */}
        <div className="flex items-center gap-1">
          {aiEnabled ? (
            <button
              aria-label={esPropia ? "Mejorar con IA" : "Generar con IA"}
              className="flex size-7 items-center justify-center rounded-lg text-primary transition hover:bg-primary/10 active:scale-95"
              disabled={isPending}
              onClick={() => openAi(esPropia ? "enhance" : "origin")}
              title={esPropia ? "Mejorar con IA" : "Generar con IA"}
              type="button"
            >
              <Sparkles className="size-4" />
            </button>
          ) : null}
          {esPropia ? (
            <button
              aria-label="Quitar foto"
              className="flex size-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 active:scale-95"
              disabled={isPending}
              onClick={remove}
              title="Quitar foto"
              type="button"
            >
              <Trash2 className="size-3.5" />
            </button>
          ) : null}
        </div>

        <CatalogUploader onFile={pick} uploaderRef={uploaderRef} />

        {error ? <p className="w-20 text-center text-[0.625rem] font-bold text-rose-600">{error}</p> : null}

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
          onClick={() => (src || !aiEnabled ? openPicker() : openAi("origin"))}
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

      {/* El Uploader de EJ2: abre el selector, valida el tipo de archivo y
          entrega el archivo en `selected`. Vive oculto porque la tarjeta de
          arriba (con su preview, su botón de IA y su quitar) es la cara que ve
          el dueño. */}
      <CatalogUploader onFile={pick} uploaderRef={uploaderRef} />

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
