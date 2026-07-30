// Lectura de códigos de barras / QR desde la cámara.
//
// Dos motores, por compatibilidad real:
//   - `BarcodeDetector` nativo (Chrome en Android): lo resuelve el sistema, gasta
//     mucha menos batería y engancha el código más rápido.
//   - ZXing (iOS/Safari, Firefox): no hay API nativa, así que decodificamos en JS.
//
// La elección es en runtime; el resto de la app no se entera de cuál se usó.

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

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      // `environment` = cámara trasera, que es la que apunta al producto.
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  });

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
  const detector = new Ctor({ formats: FORMATS });
  let stopped = false;
  let frame = 0;

  const tick = async () => {
    if (stopped) return;

    try {
      const found = await detector.detect(video);
      if (!stopped && found.length > 0) {
        onResult({ value: found[0].rawValue, format: found[0].format });
      }
    } catch {
      // Un frame que no se pudo analizar no es un error del usuario: se sigue.
    }

    if (!stopped) {
      frame = requestAnimationFrame(() => void tick());
    }
  };

  void tick().catch(() => onError("No pudimos leer con la cámara."));

  return {
    stop: () => {
      stopped = true;
      cancelAnimationFrame(frame);
    },
  };
}

async function scanWithZxing(
  video: HTMLVideoElement,
  onResult: (result: ScanResult) => void,
  onError: (message: string) => void,
): Promise<Scanner> {
  try {
    // Import dinámico: ZXing pesa, y en Android nunca se llega a cargar.
    const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
      import("@zxing/browser"),
      import("@zxing/library"),
    ]);

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

    const reader = new BrowserMultiFormatReader(hints);
    let stopped = false;

    const controls = await reader.decodeFromVideoElement(video, (result) => {
      if (stopped || !result) return;
      onResult({ value: result.getText(), format: String(result.getBarcodeFormat()) });
    });

    return {
      stop: () => {
        stopped = true;
        controls.stop();
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
