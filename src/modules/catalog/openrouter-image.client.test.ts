import { afterEach, describe, expect, it, vi } from "vitest";

import { ProductImageAiError, ProductImageAiErrorCode } from "./product-image-ai.errors";
import { requestOpenRouterImages } from "./openrouter-image.client";

afterEach(() => vi.unstubAllGlobals());

describe("requestOpenRouterImages", () => {
  it("pide una imagen cuadrada sin referencia", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        data: [{ b64_json: Buffer.from("image").toString("base64"), media_type: "image/png" }],
        usage: { cost: 0.105 },
      }), { status: 200, headers: { "content-type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestOpenRouterImages({ apiKey: "secret", prompt: "tomate" });

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(request.body));
    expect(body).toMatchObject({ model: "recraft/recraft-v4.1-utility", prompt: "tomate", n: 1, aspect_ratio: "1:1" });
    expect(body.input_references).toBeUndefined();
    expect(result.images).toHaveLength(1);
    expect(result.cost).toBe(0.105);
  });

  it("envía la foto como única referencia al mejorar", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        data: [{ b64_json: Buffer.from("image").toString("base64"), media_type: "image/webp" }],
      }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await requestOpenRouterImages({
      apiKey: "secret",
      prompt: "mejorar",
      reference: { data: Buffer.from("source"), contentType: "image/webp" },
    });

    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.input_references).toEqual([
      { type: "image_url", image_url: { url: `data:image/webp;base64,${Buffer.from("source").toString("base64")}` } },
    ]);
  });

  it.each([
    [401, ProductImageAiErrorCode.PROVIDER_AUTH],
    [402, ProductImageAiErrorCode.PROVIDER_PAYMENT],
    [429, ProductImageAiErrorCode.PROVIDER_RATE_LIMIT],
    [503, ProductImageAiErrorCode.PROVIDER_UNAVAILABLE],
  ])("mapea el estado %s", async (status, code) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status })));

    await expect(requestOpenRouterImages({ apiKey: "secret", prompt: "x" })).rejects.toMatchObject({ code });
  });

  it("rechaza una respuesta sin la cantidad pedida", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 })));

    await expect(requestOpenRouterImages({ apiKey: "secret", prompt: "x" })).rejects.toEqual(
      new ProductImageAiError(ProductImageAiErrorCode.INVALID_PROVIDER_RESPONSE),
    );
  });
});
