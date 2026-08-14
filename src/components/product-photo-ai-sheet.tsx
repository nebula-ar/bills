"use client";

import {
  confirmGeneratedProductImageAction,
  generateProductImageOptionsAction,
} from "@/app/catalog/image-ai-actions";
import { Camera, Check, ImageIcon, Loader2, RotateCcw, ShieldCheck, Sparkles, X } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import type {
  ProductImageAiMode,
  ProductImageAiStyle,
  ProductImageAiTouch,
} from "@/modules/catalog/product-image-ai.logic";
import { useState, useTransition } from "react";

type Step = "origin" | "configure" | "results";

export function ProductPhotoAiSheet({
  open,
  initialMode,
  productId,
  productName,
  productDescription,
  sourceSrc,
  onClose,
  onUsePhoto,
  onSaved,
}: {
  open: boolean;
  initialMode: "origin" | "enhance";
  productId: string;
  productName: string;
  productDescription: string | null;
  sourceSrc: string | null;
  onClose: () => void;
  onUsePhoto: () => void;
  onSaved: (version: number) => void;
}) {
  const initialRequestMode: ProductImageAiMode = initialMode === "enhance" ? "enhance" : "describe";
  const [step, setStep] = useState<Step>(initialMode === "origin" ? "origin" : "configure");
  const [mode, setMode] = useState<ProductImageAiMode>(initialRequestMode);
  const [instruction, setInstruction] = useState(
    initialRequestMode === "enhance"
      ? "Fondo claro, más luz y producto centrado"
      : productDescription ?? "",
  );
  const [style, setStyle] = useState<ProductImageAiStyle>("clean_catalog");
  const [touches, setTouches] = useState<ProductImageAiTouch[]>(
    initialRequestMode === "enhance"
      ? ["clean_background", "natural_light"]
      : ["clean_background", "natural_light"],
  );
  const [candidates, setCandidates] = useState<string[]>([]);
  const [selected, setSelected] = useState(0);
  const [showOriginal, setShowOriginal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function chooseDescription() {
    setMode("describe");
    setInstruction(productDescription ?? "");
    setTouches(["clean_background", "natural_light"]);
    setStep("configure");
  }

  function toggleTouch(touch: ProductImageAiTouch) {
    setTouches((current) => current.includes(touch) ? current.filter((item) => item !== touch) : [...current, touch]);
  }

  function generate() {
    setError(null);
    startTransition(async () => {
      const result = await generateProductImageOptionsAction({
        productId,
        request: { mode, instruction, style: mode === "describe" ? style : undefined, touches },
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      const nextCandidates = mode === "describe"
        ? [...candidates, ...result.candidates]
        : result.candidates;
      setCandidates(nextCandidates);
      setSelected(nextCandidates.length - 1);
      setShowOriginal(false);
      setStep("results");
    });
  }

  function confirm() {
    const candidate = candidates[selected];
    if (!candidate) return;

    setError(null);
    startTransition(async () => {
      const result = await confirmGeneratedProductImageAction({ productId, candidate });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved(result.version);
      onClose();
    });
  }

  const close = () => {
    if (!isPending) onClose();
  };

  return (
    <BottomSheet
      onClose={close}
      open={open}
      // Portal a document.body (ver ui/bottom-sheet.tsx): fuera del <main> de
      // Productos, así que el azul/ink de esta pantalla no cascadea solo.
      // --primary-strong igual a --primary a propósito: Apple no oscurece en
      // hover/press, usa transform: scale(0.95) como toda la marca de estado.
      panelClassName="min-h-[52dvh] [--primary:#0066cc] [--primary-strong:#0066cc] [--foreground:#1d1d1f] [--background:#f5f5f7]"
      size="dialog"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex shrink-0 items-start justify-between gap-3 px-5 pb-4 pt-2 sm:px-7">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {step === "origin" ? "Creá la imagen del producto" : step === "results" ? resultTitle(mode) : configureTitle(mode)}
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              {step === "origin"
                ? "Elegí el punto de partida. Después podés revisar antes de usarla."
                : step === "results"
                  ? mode === "enhance" ? "Revisala antes de reemplazar la actual." : "Generamos una imagen desde tu descripción."
                  : mode === "enhance" ? productName : "Describí el producto. No necesitás sacar una foto."}
            </p>
          </div>
          <button
            aria-label="Cerrar"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-500 transition active:scale-95 disabled:opacity-50"
            disabled={isPending}
            onClick={close}
            type="button"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-7">
          {step === "origin" ? (
            <div className="grid gap-3">
              <button
                className="flex min-h-24 w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left transition active:scale-[0.99]"
                onClick={onUsePhoto}
                type="button"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Camera className="size-6" />
                </span>
                <span>
                  <span className="block text-sm font-black text-foreground">Usar una foto</span>
                  <span className="mt-1 block text-xs font-medium text-slate-500">Sacá una ahora o elegí una de tu galería.</span>
                </span>
              </button>
              <button
                className="flex min-h-28 w-full items-center gap-4 rounded-2xl bg-primary p-4 text-left text-white transition active:scale-[0.99]"
                onClick={chooseDescription}
                type="button"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                  <Sparkles className="size-6" />
                </span>
                <span>
                  <span className="block text-sm font-black">Generar desde descripción</span>
                  <span className="mt-1 block text-xs font-medium text-primary-foreground/75">Contanos qué vendés y la IA crea una foto lista para catálogo.</span>
                </span>
              </button>
              <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">
                También podés seguir sin imagen y agregarla más adelante.
              </p>
            </div>
          ) : step === "configure" ? (
            <div className="grid gap-4">
              {mode === "enhance" && sourceSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={`Foto actual de ${productName}`} className="aspect-video w-full rounded-3xl object-cover" src={sourceSrc} />
              ) : (
                <div className="flex items-center gap-2 rounded-2xl bg-primary/10 px-4 py-3 text-sm font-black text-primary">
                  <ImageIcon className="size-5" />
                  Producto: {productName}
                </div>
              )}

              <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                {mode === "enhance" ? "¿Cómo querés que quede?" : "Descripción del producto"}
                <div className="relative">
                  <textarea
                    className="min-h-28 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pb-7 text-sm font-semibold normal-case tracking-normal text-foreground outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/20"
                    maxLength={300}
                    onChange={(event) => setInstruction(event.target.value)}
                    value={instruction}
                  />
                  <span className="absolute bottom-2 right-3 text-[11px] font-bold text-slate-400">{instruction.length}/300</span>
                </div>
              </label>

              <div>
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">Toques rápidos</p>
                <div className="mt-2 flex overflow-x-auto snap-x snap-mandatory gap-2 pr-12 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {TOUCH_OPTIONS.map((option) => (
                    <button
                      className={`min-h-11 shrink-0 snap-start rounded-full px-4 text-xs font-black transition active:scale-95 ${
                        touches.includes(option.value) ? "bg-primary text-white" : "bg-primary/10 text-primary"
                      }`}
                      key={option.value}
                      onClick={() => toggleTouch(option.value)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {mode === "describe" ? (
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Estilo para venta</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {STYLE_OPTIONS.map((option) => (
                      <button
                        className={`min-h-14 rounded-2xl border px-3 text-sm font-black transition active:scale-95 ${
                          style === option.value
                            ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                        key={option.value}
                        onClick={() => setStyle(option.value)}
                        type="button"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <p className="flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                No agregamos marcas, envases ni elementos que no describiste.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {mode === "enhance" ? (
                <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
                  <button className={`min-h-11 rounded-xl text-sm font-black transition active:scale-95 ${showOriginal ? "bg-white text-foreground shadow-sm" : "text-slate-500"}`} onClick={() => setShowOriginal(true)} type="button">Original</button>
                  <button className={`min-h-11 rounded-xl text-sm font-black transition active:scale-95 ${!showOriginal ? "bg-white text-primary shadow-sm" : "text-slate-500"}`} onClick={() => setShowOriginal(false)} type="button">Mejorada con IA</button>
                </div>
              ) : null}

              <div className="overflow-hidden rounded-3xl border-2 border-primary bg-slate-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={showOriginal ? `Foto original de ${productName}` : `Opción generada para ${productName}`}
                  className="aspect-square w-full object-cover"
                  src={showOriginal && sourceSrc ? sourceSrc : candidates[selected]}
                />
              </div>

              {mode === "describe" && candidates.length > 1 ? (
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Versiones · {candidates.length}
                  </p>
                  <div className="mt-2 flex snap-x snap-mandatory gap-2 overflow-x-auto pr-12 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {candidates.map((candidate, index) => (
                      <button
                        aria-label={`Elegir versión ${index + 1}`}
                        className={`w-20 shrink-0 snap-start overflow-hidden rounded-2xl border-2 transition active:scale-95 ${selected === index ? "border-primary ring-2 ring-primary/20" : "border-slate-200"}`}
                        key={index}
                        onClick={() => setSelected(index)}
                        type="button"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img alt="" className="aspect-square w-full object-cover" src={candidate} />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
                {mode === "enhance" ? "La foto actual sigue guardada hasta que confirmes." : "Al regenerar, la versión anterior queda disponible para elegir."}
              </p>
            </div>
          )}

          {error ? <p className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-xs font-bold text-rose-600">{error}</p> : null}
        </div>

        {step !== "origin" ? (
          <footer className="flex shrink-0 gap-2 border-t border-slate-100 bg-white px-5 pb-1 pt-4 sm:px-7">
            {step === "results" ? (
              <button
                className="flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-600 transition active:scale-95 disabled:opacity-50"
                disabled={isPending}
                onClick={generate}
                type="button"
              >
                {isPending ? <Loader2 className="size-5 animate-spin" /> : <RotateCcw className="size-5" />}
                Regenerar
              </button>
            ) : null}
            <button
              className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-black text-white transition active:scale-95 disabled:opacity-50"
              disabled={isPending || !instruction.trim() || (step === "results" && showOriginal)}
              onClick={step === "results" ? confirm : generate}
              type="button"
            >
              {isPending ? <Loader2 className="size-5 animate-spin" /> : step === "results" ? <Check className="size-5" /> : <Sparkles className="size-5" />}
              {isPending ? "Procesando…" : step === "results" ? "Usar esta foto" : mode === "describe" ? "Generar imagen" : "Generar mejora"}
            </button>
          </footer>
        ) : null}
      </div>
    </BottomSheet>
  );
}

function configureTitle(mode: ProductImageAiMode) {
  return mode === "enhance" ? "Mejorar foto con IA" : "Generar foto con IA";
}

function resultTitle(mode: ProductImageAiMode) {
  return mode === "enhance" ? "Tu foto está lista" : "Elegí una imagen";
}

const TOUCH_OPTIONS: Array<{ value: ProductImageAiTouch; label: string }> = [
  { value: "clean_background", label: "Fondo limpio" },
  { value: "natural_light", label: "Luz natural" },
  { value: "close_up", label: "Primer plano" },
];

const STYLE_OPTIONS: Array<{ value: ProductImageAiStyle; label: string }> = [
  { value: "clean_catalog", label: "Catálogo limpio" },
  { value: "ambient", label: "Ambientada" },
];
