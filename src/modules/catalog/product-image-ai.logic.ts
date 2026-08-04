export const PRODUCT_IMAGE_AI_LIMIT = 5;
export const PRODUCT_IMAGE_AI_LEASE_MS = 90_000;
export const PRODUCT_IMAGE_AI_TIMEOUT_MS = 45_000;
export const PRODUCT_IMAGE_AI_MODEL = "recraft/recraft-v4.1";
export const PRODUCT_IMAGE_AI_MAX_TEXT = 300;
export const PRODUCT_IMAGE_AI_MAX_CANDIDATE_BYTES = 220 * 1024;

export type ProductImageAiMode = "enhance" | "describe";
export type ProductImageAiStyle = "clean_catalog" | "ambient";
export type ProductImageAiTouch = "clean_background" | "natural_light" | "close_up";

export type ProductImageAiRequest = {
  mode: ProductImageAiMode;
  instruction: string;
  style?: ProductImageAiStyle;
  touches: ProductImageAiTouch[];
};

const MODES = new Set<ProductImageAiMode>(["enhance", "describe"]);
const STYLES = new Set<ProductImageAiStyle>(["clean_catalog", "ambient"]);
const TOUCHES = new Set<ProductImageAiTouch>(["clean_background", "natural_light", "close_up"]);

export function parseProductImageAiRequest(value: unknown): ProductImageAiRequest | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Record<string, unknown>;
  const mode = candidate.mode;
  const instruction = typeof candidate.instruction === "string" ? candidate.instruction.trim() : "";
  const style = candidate.style;
  const touches = candidate.touches;

  if (!MODES.has(mode as ProductImageAiMode) || !instruction || instruction.length > PRODUCT_IMAGE_AI_MAX_TEXT) {
    return null;
  }

  if (!Array.isArray(touches) || touches.some((touch) => !TOUCHES.has(touch as ProductImageAiTouch))) {
    return null;
  }

  const uniqueTouches = [...new Set(touches)] as ProductImageAiTouch[];

  if (mode === "describe") {
    if (!STYLES.has(style as ProductImageAiStyle)) return null;
    return { mode, instruction, style: style as ProductImageAiStyle, touches: uniqueTouches };
  }

  return { mode: "enhance", instruction, touches: uniqueTouches };
}

export function buildProductImagePrompt(input: ProductImageAiRequest & {
  productName: string;
  productDescription: string | null;
}): string {
  const touches = input.touches.map((touch) => TOUCH_PROMPTS[touch]).join(", ");
  const description = input.productDescription ? ` Descripción existente: ${input.productDescription}.` : "";
  const common = [
    "Imagen comercial cuadrada 1:1, un solo producto como protagonista, lista para un catálogo de venta.",
    "Sin texto, marcas de agua ni elementos promocionales.",
    "No inventes marcas, envases, etiquetas, ingredientes ni atributos que no estén descriptos o visibles.",
  ].join(" ");

  if (input.mode === "enhance") {
    return [
      common,
      `Producto: ${input.productName}.${description}`,
      "Editá la foto de referencia. Conservá exactamente la identidad visual, forma, color, variedad y presentación real del producto.",
      `Pedido del comercio: ${input.instruction}.`,
      touches ? `Ajustes: ${touches}.` : "",
    ].filter(Boolean).join(" ");
  }

  return [
    common,
    `Producto: ${input.productName}.${description}`,
    `Descripción solicitada: ${input.instruction}.`,
    `Estilo: ${STYLE_PROMPTS[input.style!]}.`,
    touches ? `Ajustes: ${touches}.` : "",
  ].filter(Boolean).join(" ");
}

export function imageUsageDay(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function decodeGeneratedImageCandidate(value: string): Buffer | null {
  if (typeof value !== "string" || value.length > PRODUCT_IMAGE_AI_MAX_CANDIDATE_BYTES * 2) return null;
  const match = /^data:image\/webp;base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return null;

  const data = Buffer.from(match[1], "base64");
  return data.byteLength > 0 && data.byteLength <= PRODUCT_IMAGE_AI_MAX_CANDIDATE_BYTES ? data : null;
}

const TOUCH_PROMPTS: Record<ProductImageAiTouch, string> = {
  clean_background: "fondo limpio y sin distracciones",
  natural_light: "luz natural suave",
  close_up: "primer plano del producto",
};

const STYLE_PROMPTS: Record<ProductImageAiStyle, string> = {
  clean_catalog: "catálogo limpio, fondo claro neutro y composición centrada",
  ambient: "ambientada en un contexto de venta realista, ordenado y sin personas",
};
