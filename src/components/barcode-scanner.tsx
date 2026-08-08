"use client";

import { Flashlight, Loader2, X } from "@/components/icons";
import {
  captureFrame,
  cleanCode,
  openCamera,
  setTorch,
  startScanning,
  stopCamera,
  torchAvailable,
  type Scanner,
} from "@/lib/barcode";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

// Cámara a pantalla completa que lee códigos de barras y QR.
//
// Es el mismo componente para las dos cosas que se hacen con la cámara —cargar
// un producto nuevo y venderlo— porque el gesto es idéntico: apuntar y leer. Lo
// que cambia es qué hace el que la usa con el código (`onDetect`).
//
// Con `panel`, la cámara ocupa la franja de arriba y abajo queda un panel fijo
// (en la venta: el pedido, con cantidades y total). Es la diferencia entre
// escanear a ciegas y ver lo que llevás mientras pasás la mercadería: el error
// de haber sumado dos veces el mismo envase se ve en el momento, no en el total.

export type ScannerMode = "single" | "continuous";

type BarcodeScannerProps = {
  open: boolean;
  title: string;
  hint?: string;
  // `single`: se cierra al primer código (alta de producto).
  // `continuous`: sigue leyendo para cargar varios ítems seguidos (venta).
  mode?: ScannerMode;
  onDetect: (code: string, takePhoto: () => Promise<File | null>) => void | Promise<void>;
  onClose: () => void;
  // Mensaje efímero que muestra el que la usa ("Alfajor triple +1").
  feedback?: { tone: "ok" | "warn"; text: string } | null;
  // Panel bajo la cámara. Sin esto, la cámara ocupa todo el alto.
  panel?: ReactNode;
};

// Cuánto tiene que dejar de verse un código para volver a aceptarlo. Sin esto,
// uno quieto frente a la cámara se leería decenas de veces por segundo.
//
// Va por "dejó de verse" y no por un tiempo fijo desde la última lectura: seis
// yogures iguales se pasan uno atrás de otro, y esperar dos segundos entre cada
// uno es exactamente la lentitud que se siente en el mostrador. Mientras el
// código siga en cuadro no se repite; apenas sale, el siguiente entra.
const CODE_LEFT_FRAME_MS = 500;

export function BarcodeScanner({
  open,
  title,
  hint,
  mode = "single",
  onDetect,
  onClose,
  feedback,
  panel,
}: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerRef = useRef<Scanner | null>(null);
  const lastCodeRef = useRef<{ code: string; seenAt: number } | null>(null);
  // El callback cambia en cada render del padre; lo guardamos para no reiniciar
  // la cámara cada vez (reiniciarla parpadea y tarda).
  const onDetectRef = useRef(onDetect);

  // Se actualiza después del render, no durante: tocar un ref mientras se
  // renderiza es justamente lo que hace que React no vea el cambio.
  useEffect(() => {
    onDetectRef.current = onDetect;
  });

  const [status, setStatus] = useState<"idle" | "starting" | "scanning" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [torchReady, setTorchReady] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const takePhoto = useCallback(async () => {
    return videoRef.current ? captureFrame(videoRef.current) : null;
  }, []);

  useEffect(() => {
    if (!open) return;

    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    setStatus("starting");
    setError(null);

    (async () => {
      try {
        const stream = await openCamera(video);
        if (cancelled) {
          stopCamera(video, stream);
          return;
        }
        streamRef.current = stream;
        setTorchReady(torchAvailable(stream));

        const scanner = await startScanning({
          video,
          onError: (message) => {
            setError(message);
            setStatus("error");
          },
          onResult: ({ value }) => {
            const code = cleanCode(value);
            if (!code) return;

            const previous = lastCodeRef.current;
            const now = Date.now();

            if (previous && previous.code === code) {
              const salioDeCuadro = now - previous.seenAt > CODE_LEFT_FRAME_MS;
              // Se sigue viendo el mismo: se anota y, si no llegó a salir de
              // cuadro, se ignora.
              previous.seenAt = now;

              if (!salioDeCuadro) return;
            }

            lastCodeRef.current = { code, seenAt: now };

            // Vibración corta: en el mostrador confirma la lectura sin mirar.
            navigator.vibrate?.(40);

            void onDetectRef.current(code, takePhoto);
          },
        });

        if (cancelled) {
          scanner.stop();
          return;
        }

        scannerRef.current = scanner;
        setStatus("scanning");
      } catch (cause) {
        if (cancelled) return;
        const message =
          cause instanceof DOMException && (cause.name === "NotAllowedError" || cause.name === "SecurityError")
            ? "Necesitamos permiso para usar la cámara. Habilitalo y volvé a intentar."
            : cause instanceof Error
              ? cause.message
              : "No pudimos abrir la cámara.";
        setError(message);
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      scannerRef.current?.stop();
      scannerRef.current = null;
      // Apagar la cámara al cerrar no es opcional: si no, el LED queda prendido
      // y el teléfono se calienta.
      if (video) {
        stopCamera(video, streamRef.current);
      }
      streamRef.current = null;
      lastCodeRef.current = null;
      setTorchReady(false);
      setTorchOn(false);
    };
  }, [open, takePhoto]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-slate-950">
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <h2 className="text-lg font-black tracking-tight text-white">{title}</h2>
          {hint ? <p className="mt-0.5 text-sm text-white/60">{hint}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* Con el código a la sombra del mostrador, la linterna es la
              diferencia entre leer y no leer. */}
          {torchReady ? (
            <button
              aria-label={torchOn ? "Apagar la luz" : "Prender la luz"}
              aria-pressed={torchOn}
              className={`flex size-11 items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 active:scale-90 ${
                torchOn ? "bg-amber-300 text-slate-900" : "bg-white/10 text-white"
              }`}
              onClick={async () => {
                const next = !torchOn;
                const ok = await setTorch(streamRef.current, next);
                if (ok) setTorchOn(next);
              }}
              type="button"
            >
              <Flashlight className="size-5" />
            </button>
          ) : null}

          <button
            aria-label="Cerrar"
            className="flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 active:scale-90"
            onClick={onClose}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      {/* Con panel, la cámara cede la mitad de abajo: sigue siendo cómoda para
          apuntar y deja ver el pedido sin cerrar el lector. */}
      {/* `overflow-hidden` no es cosmético: el velo del marco de puntería es una
          sombra de 100vmax y, sin recortar, oscurece también el panel de abajo. */}
      <div className={panel ? "relative h-[38dvh] shrink-0 overflow-hidden" : "relative min-h-0 flex-1 overflow-hidden"}>
        <video className="size-full object-cover" muted playsInline ref={videoRef} />

        {/* Marco de puntería: ayuda a encuadrar el código. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className={`w-[78%] max-w-sm rounded-2xl border-2 border-white/80 shadow-[0_0_0_100vmax_rgba(2,6,23,0.55)] ${
              panel ? "h-28" : "h-40"
            }`}
          />
        </div>

        {status === "starting" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/80 text-white">
            <Loader2 className="size-6 animate-spin" />
            <p className="text-sm font-semibold">Abriendo la cámara…</p>
          </div>
        ) : null}

        {status === "error" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/90 px-8 text-center text-white">
            <p className="text-sm font-semibold">{error}</p>
            <button
              className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-900 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 active:scale-95"
              onClick={onClose}
              type="button"
            >
              Cerrar
            </button>
          </div>
        ) : null}

        {/* Escribir el código a mano y el aviso de la última lectura van
            superpuestos: no le roban alto ni a la cámara ni al pedido. */}
        <div className="absolute inset-x-0 bottom-0 space-y-2 bg-gradient-to-t from-slate-950/90 to-transparent px-4 pb-3 pt-8">
          {feedback ? (
            <p
              className={`rounded-2xl bg-slate-950/80 px-4 py-2.5 text-center text-sm font-black ${
                feedback.tone === "ok" ? "text-emerald-300" : "text-amber-300"
              }`}
              data-testid="scan-feedback"
            >
              {feedback.text}
            </p>
          ) : null}

        {manualOpen ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const code = cleanCode(manual);
              if (!code) return;
              setManual("");
              void onDetectRef.current(code, takePhoto);
            }}
          >
            <input
              aria-label="Código de barras"
              autoComplete="off"
              className="min-w-0 flex-1 rounded-2xl bg-white/10 px-4 py-3 text-base font-bold text-white outline-none placeholder:text-white/40"
              inputMode="numeric"
              name="code"
              onChange={(event) => setManual(event.target.value)}
              placeholder="7790001000017"
              value={manual}
            />
            <button
              className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-900 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 active:scale-95"
              type="submit"
            >
              Buscar
            </button>
          </form>
        ) : (
          <button
            className="w-full rounded-2xl bg-slate-950/70 py-2.5 text-xs font-bold text-white/80 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 active:scale-95"
            onClick={() => setManualOpen(true)}
            type="button"
          >
            Escribir el código a mano
          </button>
        )}
        </div>
      </div>

      {panel ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-[1.75rem] bg-white">{panel}</div>
      ) : (
        <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
          <p className="text-center text-xs text-white/50">
            {mode === "continuous"
              ? "Escaneá un producto atrás de otro. Se van sumando al carrito."
              : "Apuntá al código de barras del producto."}
          </p>
        </div>
      )}
    </div>
  );
}
