import {
  PRODUCT_IMAGE_AI_MODEL,
  PRODUCT_IMAGE_AI_TIMEOUT_MS,
} from "./product-image-ai.logic";
import { ProductImageAiError, ProductImageAiErrorCode } from "./product-image-ai.errors";

const OPENROUTER_IMAGES_URL = "https://openrouter.ai/api/v1/images";
const ALLOWED_MEDIA_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export type OpenRouterImageRequest = {
  apiKey: string;
  prompt: string;
  reference?: { data: Buffer; contentType: string };
};

export type OpenRouterImageResponse = {
  images: Array<{ data: Buffer; contentType: string }>;
  cost: number | null;
};

export async function requestOpenRouterImages(input: OpenRouterImageRequest): Promise<OpenRouterImageResponse> {
  const body: Record<string, unknown> = {
    model: PRODUCT_IMAGE_AI_MODEL,
    prompt: input.prompt,
    n: 1,
    aspect_ratio: "1:1",
  };

  if (input.reference) {
    body.input_references = [{
      type: "image_url",
      image_url: {
        url: `data:${input.reference.contentType};base64,${input.reference.data.toString("base64")}`,
      },
    }];
  }

  let response: Response;

  try {
    response = await fetch(OPENROUTER_IMAGES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
        "X-OpenRouter-Title": "Bills",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(PRODUCT_IMAGE_AI_TIMEOUT_MS),
    });
  } catch {
    throw new ProductImageAiError(ProductImageAiErrorCode.PROVIDER_UNAVAILABLE);
  }

  if (!response.ok) {
    throw providerError(response.status, response.headers.get("retry-after"));
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ProductImageAiError(ProductImageAiErrorCode.INVALID_PROVIDER_RESPONSE);
  }

  const parsed = parseResponse(payload, 1);
  if (!parsed) {
    throw new ProductImageAiError(ProductImageAiErrorCode.INVALID_PROVIDER_RESPONSE);
  }

  return parsed;
}

function parseResponse(payload: unknown, expected: number): OpenRouterImageResponse | null {
  if (!payload || typeof payload !== "object") return null;
  const object = payload as Record<string, unknown>;
  if (!Array.isArray(object.data) || object.data.length < expected) return null;

  const images = object.data.slice(0, expected).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as Record<string, unknown>;
    if (typeof candidate.b64_json !== "string" || !candidate.b64_json) return [];
    const contentType = typeof candidate.media_type === "string" ? candidate.media_type : "image/png";
    if (!ALLOWED_MEDIA_TYPES.has(contentType)) return [];

    try {
      const data = Buffer.from(candidate.b64_json, "base64");
      return data.byteLength > 0 ? [{ data, contentType }] : [];
    } catch {
      return [];
    }
  });

  if (images.length !== expected) return null;

  const usage = object.usage && typeof object.usage === "object" ? object.usage as Record<string, unknown> : null;
  const cost = typeof usage?.cost === "number" && Number.isFinite(usage.cost) ? usage.cost : null;
  return { images, cost };
}

function providerError(status: number, retryAfter: string | null) {
  if (status === 401 || status === 403) return new ProductImageAiError(ProductImageAiErrorCode.PROVIDER_AUTH);
  if (status === 402) return new ProductImageAiError(ProductImageAiErrorCode.PROVIDER_PAYMENT);
  if (status === 429) {
    const seconds = retryAfter ? Number.parseInt(retryAfter, 10) : undefined;
    return new ProductImageAiError(
      ProductImageAiErrorCode.PROVIDER_RATE_LIMIT,
      Number.isFinite(seconds) ? seconds : undefined,
    );
  }
  return new ProductImageAiError(ProductImageAiErrorCode.PROVIDER_UNAVAILABLE);
}
