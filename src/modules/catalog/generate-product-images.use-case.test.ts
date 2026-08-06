import { describe, expect, it, vi } from "vitest";

import { ProductImageAiErrorCode } from "./product-image-ai.errors";
import { generateProductImageOptions, type GenerateProductImageDependencies } from "./generate-product-images.use-case";

function dependencies(overrides: Partial<GenerateProductImageDependencies> = {}): GenerateProductImageDependencies {
  return {
    apiKey: () => "secret",
    now: () => new Date("2026-08-04T15:00:00.000Z"),
    findProduct: vi.fn().mockResolvedValue({ id: "p1", name: "Tomate", description: null, image: null }),
    claim: vi.fn().mockResolvedValue({ leaseUntil: new Date("2026-08-04T15:01:30.000Z") }),
    release: vi.fn().mockResolvedValue({ count: 1 }),
    requestImages: vi.fn().mockResolvedValue({
      images: [{ data: Buffer.from("raw"), contentType: "image/png" }],
      cost: 0.1,
    }),
    normalize: vi.fn().mockImplementation(async () => Buffer.from("normalized")),
    audit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("generateProductImageOptions", () => {
  it("genera un preview desde descripción y libera el lock", async () => {
    const deps = dependencies();

    const result = await generateProductImageOptions({
      businessId: "b1",
      productId: "p1",
      userId: "u1",
      request: { mode: "describe", instruction: "Rojo intenso", style: "clean_catalog", touches: [] },
    }, deps);

    expect(result.candidates).toHaveLength(1);
    expect(deps.requestImages).toHaveBeenCalledWith(expect.objectContaining({ reference: undefined }));
    expect(deps.release).toHaveBeenCalledOnce();
  });

  it("no usa la foto existente cuando el modo es desde descripción", async () => {
    const deps = dependencies({
      findProduct: vi.fn().mockResolvedValue({
        id: "p1",
        name: "Tomate",
        description: null,
        image: { data: new Uint8Array(Buffer.from("source")), contentType: "image/webp" },
      }),
    });

    await generateProductImageOptions({
      businessId: "b1",
      productId: "p1",
      userId: "u1",
      request: { mode: "describe", instruction: "Tomate", style: "clean_catalog", touches: [] },
    }, deps);

    expect(deps.requestImages).toHaveBeenCalledWith(expect.objectContaining({ reference: undefined }));
  });

  it("requiere foto propia antes de consumir cupo para mejorar", async () => {
    const deps = dependencies();

    await expect(generateProductImageOptions({
      businessId: "b1",
      productId: "p1",
      userId: "u1",
      request: { mode: "enhance", instruction: "Más luz", touches: [] },
    }, deps)).rejects.toMatchObject({ code: ProductImageAiErrorCode.SOURCE_IMAGE_REQUIRED });

    expect(deps.claim).not.toHaveBeenCalled();
  });

  it("libera el lock cuando falla el proveedor", async () => {
    const failure = new Error("provider down");
    const deps = dependencies({
      requestImages: vi.fn().mockRejectedValue(failure),
    });

    await expect(generateProductImageOptions({
      businessId: "b1",
      productId: "p1",
      userId: "u1",
      request: { mode: "describe", instruction: "Tomate", style: "ambient", touches: [] },
    }, deps)).rejects.toBe(failure);

    expect(deps.release).toHaveBeenCalledOnce();
  });

  it("no consume cupo si falta la key", async () => {
    const deps = dependencies({ apiKey: () => undefined });

    await expect(generateProductImageOptions({
      businessId: "b1",
      productId: "p1",
      userId: "u1",
      request: { mode: "describe", instruction: "Tomate", style: "ambient", touches: [] },
    }, deps)).rejects.toMatchObject({ code: ProductImageAiErrorCode.CONFIG_MISSING });
    expect(deps.claim).not.toHaveBeenCalled();
  });
});
