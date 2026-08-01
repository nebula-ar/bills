// Lectura de códigos de barras / QR desde la cámara.
//
// Dos motores, por compatibilidad real:
//   - `BarcodeDetector` nativo (Chrome en Android): lo resuelve el sistema, gasta
//     mucha menos batería y engancha el código más rápido.
//   - ZXing (iOS/Safari, Firefox): no hay API nativa, así que decodificamos en JS.
//
// La elección es en runtime; el resto de la app no se entera de cuál se usó.
//
// Tres cosas hacen la diferencia entre "engancha al toque" y "no lee nunca":
//
//   1. NO analizar el cuadro entero. Se recorta la banda del medio —donde está el
//      marco de puntería— y se decodifica solo eso. Menos de la mitad de los
//      píxeles por intento, y sin la mercadería del fondo metiendo ruido.
//   2. Intentar en CADA cuadro de la cámara. El lector de ZXing que veníamos
//      usando esperaba 500 ms entre intento e intento: en un iPhone eso son dos
//      lecturas por segundo, y de ahí venía la sensación de que "tarda".
//   3. Enfoque continuo y buena resolución. Un código de barras chico y fuera de
//      foco no se lee por más vueltas que le dé el algoritmo.

// `BarcodeDetector` todavía no está en las libs de TS.
type DetectedBarcode = { rawValue: string; format: string };
type BarcodeDetectorLike = { detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]> };
type BarcodeDetectorCtor = {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
};

// Formatos que tiene sentido leer en un comercio: los EAN/UPC de los productos
// del mercado, los Code 128/39 de las etiquetas propias, y QR.
const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"];

// Alto de la banda que se analiza, como fracción del cuadro. Los códigos son
// anchos, así que se conserva todo el ancho y se recorta solo arriba y abajo.
const ROI_HEIGHT_RATIO = 0.5;
// Más ancho que esto no agrega información útil y sí cuesta tiempo por intento.
const ROI_MAX_WIDTH = 1280;

// `focusMode` y `torch` existen en los navegadores de celular, que es donde se
// usa esto, pero no están en los tipos estándar del DOM.
type CameraConstraintSet = MediaTrackConstraintSet & { focusMode?: string; torch?: boolean };
type CameraConstraints = Omit<MediaTrackConstraints, "advanced"> & { advanced?: CameraConstraintSet[] };

export type ScanResult = { value: string; format: string };

export type Scanner = {
  stop: () => void;
};

type StartOptions = {
  video: HTMLVideoElement;
  onResult: (result: ScanResult) => void;
  onError: (message: string) => void;
};

function nativeDetector(): BarcodeDetectorCtor | null {
  const ctor = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  return typeof ctor === "function" ? ctor : null;
}

// Pide la cámara trasera. `getUserMedia` solo existe en contextos seguros: en
// producción (HTTPS) y en localhost anda; por IP de LAN sin HTTPS, no.
export async function openCamera(video: HTMLVideoElement): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(
      window.isSecureContext
        ? "Este navegador no permite usar la cámara."
        : "Para usar la cámara la página tiene que abrirse por HTTPS (o desde localhost).",
    );
  }

  const constraints: CameraConstraints = {
    // `environment` = cámara trasera, que es la que apunta al producto.
    facingMode: { ideal: "environment" },
    // Full HD: un EAN impreso chico, o leído de lejos, no tiene suficientes
    // píxeles por barra en 720p. Si el equipo no da, el navegador baja solo.
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 30 },
    // Lo que va en `advanced` que el navegador no entienda, lo ignora. El
    // enfoque continuo es lo que hace que enganche sin tener que alejar y
    // acercar el teléfono buscando el punto.
    advanced: [{ focusMode: "continuous" }, { focusMode: "continuous-video" }],
  };

  const stream = await navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });

  video.srcObject = stream;
  // `playsInline` es obligatorio en iOS: sin esto, Safari abre el video a
  // pantalla completa y tapa la interfaz.
  video.playsInline = true;
  video.muted = true;
  await video.play();

  return stream;
}

export function stopCamera(video: HTMLVideoElement, stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
  video.srcObject = null;
}

// La linterna del teléfono. En un local con poca luz, o con el código a la
// sombra del mostrador, es la diferencia entre leer y no leer.
export function torchAvailable(stream: MediaStream | null): boolean {
  const track = stream?.getVideoTracks()[0];
  const capabilities = track?.getCapabilities?.() as { torch?: boolean } | undefined;
  return Boolean(capabilities?.torch);
}

export async function setTorch(stream: MediaStream | null, on: boolean): Promise<boolean> {
  const track = stream?.getVideoTracks()[0];

  if (!track) return false;

  try {
    const constraints: CameraConstraints = { advanced: [{ torch: on }] };
    await track.applyConstraints(constraints);
    return true;
  } catch {
    return false;
  }
}

// Qué pedazo del cuadro se copia y a qué tamaño. Separado del lienzo para poder
// probarlo: es la cuenta de la que depende que se lea la banda correcta.
export function roiFrame(videoWidth: number, videoHeight: number) {
  const bandHeight = Math.round(videoHeight * ROI_HEIGHT_RATIO);
  const scale = Math.min(1, ROI_MAX_WIDTH / videoWidth);

  return {
    // Recorte sobre el video.
    sourceTop: Math.round((videoHeight - bandHeight) / 2),
    sourceHeight: bandHeight,
    // Tamaño del lienzo que se decodifica.
    width: Math.round(videoWidth * scale),
    height: Math.round(bandHeight * scale),
  };
}

// Lienzo donde se copia, cuadro a cuadro, solo la banda que se analiza.
function createRoiCanvas() {
  const canvas = document.createElement("canvas");
  // `willReadFrequently` importa: el decodificador lee los píxeles en cada
  // intento, y sin esto el navegador mantiene el lienzo en la GPU y cada
  // lectura cuesta una copia de vuelta.
  const context = canvas.getContext("2d", { willReadFrequently: true });

  return {
    canvas,
    // Devuelve false mientras el video todavía no tiene imagen.
    draw(video: HTMLVideoElement) {
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      if (!context || !videoWidth || !videoHeight) return false;

      const { sourceTop, sourceHeight, width, height } = roiFrame(videoWidth, videoHeight);

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      context.drawImage(video, 0, sourceTop, videoWidth, sourceHeight, 0, 0, width, height);
      return true;
    },
  };
}

// Corre `run` una vez por cuadro NUEVO de la cámara cuando el navegador lo
// permite (`requestVideoFrameCallback`), y si no, por cuadro de pantalla.
// Analizar dos veces la misma imagen no encuentra nada que no haya encontrado
// la primera vez: es tiempo tirado.
function eachFrame(video: HTMLVideoElement, run: () => void | Promise<void>) {
  // Los tipos del DOM dan `requestVideoFrameCallback` por hecho, pero Firefox y
  // los Safari viejos no lo tienen: hay que preguntar en runtime igual.
  const frames: {
    requestVideoFrameCallback?: HTMLVideoElement["requestVideoFrameCallback"];
    cancelVideoFrameCallback?: HTMLVideoElement["cancelVideoFrameCallback"];
  } = video;

  const request = frames.requestVideoFrameCallback?.bind(video);
  let stopped = false;
  let handle = 0;

  const step = async () => {
    if (stopped) return;

    try {
      await run();
    } catch {
      // Un cuadro que falla no puede matar el bucle: el lector quedaría muerto
      // en pantalla, abierto y sin leer nada.
    }

    if (!stopped) {
      schedule();
    }
  };

  function schedule() {
    handle = request ? request(() => void step()) : requestAnimationFrame(() => void step());
  }

  schedule();

  return () => {
    stopped = true;
    if (request) {
      frames.cancelVideoFrameCallback?.call(video, handle);
    } else {
      cancelAnimationFrame(handle);
    }
  };
}

// Arranca la lectura continua sobre un <video> que ya tiene la cámara abierta.
export async function startScanning({ video, onResult, onError }: StartOptions): Promise<Scanner> {
  const Native = nativeDetector();

  if (Native) {
    return scanWithNative(Native, video, onResult, onError);
  }

  return scanWithZxing(video, onResult, onError);
}

function scanWithNative(
  Ctor: BarcodeDetectorCtor,
  video: HTMLVideoElement,
  onResult: (result: ScanResult) => void,
  onError: (message: string) => void,
): Scanner {
  try {
    const detector = new Ctor({ formats: FORMATS });
    const roi = createRoiCanvas();

    const stop = eachFrame(video, async () => {
      if (!roi.draw(video)) return;

      try {
        const found = await detector.detect(roi.canvas);

        if (found.length > 0) {
          onResult({ value: found[0].rawValue, format: found[0].format });
        }
      } catch {
        // Un cuadro que no se pudo analizar no es un error del usuario: se sigue.
      }
    });

    return { stop };
  } catch {
    onError("No pudimos leer con la cámara.");
    return { stop: () => {} };
  }
}

async function scanWithZxing(
  video: HTMLVideoElement,
  onResult: (result: ScanResult) => void,
  onError: (message: string) => void,
): Promise<Scanner> {
  try {
    // Import dinámico: ZXing pesa, y en Android nunca se llega a cargar.
    //
    // Se usa el lector de bajo nivel en vez del `BrowserMultiFormatReader`
    // porque ese trae su propio bucle, con 500 ms de pausa entre intentos y
    // analizando el cuadro entero. Acá el bucle y el recorte son nuestros.
    const [{ HTMLCanvasElementLuminanceSource }, zxing] = await Promise.all([
      import("@zxing/browser"),
      import("@zxing/library"),
    ]);

    const { BarcodeFormat, BinaryBitmap, DecodeHintType, HybridBinarizer, MultiFormatReader } = zxing;

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.ITF,
      BarcodeFormat.QR_CODE,
    ]);

    const reader = new MultiFormatReader();
    reader.setHints(hints);

    const roi = createRoiCanvas();

    const stop = eachFrame(video, () => {
      if (!roi.draw(video)) return;

      try {
        const source = new HTMLCanvasElementLuminanceSource(roi.canvas);
        const result = reader.decodeWithState(new BinaryBitmap(new HybridBinarizer(source)));

        if (result) {
          onResult({ value: result.getText(), format: String(result.getBarcodeFormat()) });
        }
      } catch {
        // No haber encontrado nada en este cuadro es lo normal, no un error.
      }
    });

    return {
      stop: () => {
        stop();
        reader.reset();
      },
    };
  } catch {
    onError("No pudimos iniciar el lector de códigos.");
    return { stop: () => {} };
  }
}

// Toma un cuadro del video como foto del producto. Aprovecha que la cámara ya
// está abierta y apuntando al producto: sacar la foto sale gratis.
export async function captureFrame(video: HTMLVideoElement): Promise<File | null> {
  const width = video.videoWidth;
  const height = video.videoHeight;

  if (!width || !height) {
    return null;
  }

  // Recorte cuadrado centrado: es como se muestra después en la grilla.
  const side = Math.min(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;

  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  context.drawImage(video, (width - side) / 2, (height - side) / 2, side, side, 0, 0, side, side);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", 0.85);
  });

  return blob ? new File([blob], "foto.webp", { type: "image/webp" }) : null;
}

// Normaliza lo que devuelve el lector: espacios y caracteres raros fuera.
export function cleanCode(raw: string): string {
  return raw.trim().replace(/\s+/g, "");
}
