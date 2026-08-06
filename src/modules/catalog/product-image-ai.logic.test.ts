import { describe, expect, it } from "vitest";

import {
  buildProductImagePrompt,
  decodeGeneratedImageCandidate,
  imageUsageDay,
  parseProductImageAiRequest,
} from "./product-image-ai.logic";

describe("parseProductImageAiRequest", () => {
  it("acepta una mejora con retoques conocidos", () => {
    expect(
      parseProductImageAiRequest({
        mode: "enhance",
        instruction: "  Fondo claro y más luz  ",
        touches: ["clean_background", "natural_light"],
      }),
    ).toEqual({
      mode: "enhance",
      instruction: "Fondo claro y más luz",
      touches: ["clean_background", "natural_light"],
    });
  });

  it("exige estilo al generar sin foto", () => {
    expect(
      parseProductImageAiRequest({ mode: "describe", instruction: "Tomate rojo", touches: [] }),
    ).toBeNull();
  });

  it("rechaza instrucciones de más de 300 caracteres", () => {
    expect(
      parseProductImageAiRequest({
        mode: "describe",
        instruction: "x".repeat(301),
        style: "clean_catalog",
        touches: [],
      }),
    ).toBeNull();
  });
});

describe("buildProductImagePrompt", () => {
  it("protege el producto físico al mejorar una foto", () => {
    const prompt = buildProductImagePrompt({
      mode: "enhance",
      productName: "Tomate perita",
      productDescription: "Tomate fresco de estación",
      instruction: "Fondo claro",
      touches: ["clean_background"],
    });

    expect(prompt).toContain("Tomate perita");
    expect(prompt).toContain("especificación visual obligatoria");
    expect(prompt).toContain("comida preparada");
    expect(prompt).toContain("cantidad, disposición");
    expect(prompt).toContain("No inventes marcas");
    expect(prompt).toContain("fondo limpio");
  });

  it("no permite reinterpretar tallarines como un plato servido", () => {
    const prompt = buildProductImagePrompt({
      mode: "enhance",
      productName: "Tallarines secos",
      productDescription: "Pasta larga seca, sin salsa",
      instruction: "Fondo claro y más luz",
      touches: ["clean_background", "natural_light"],
    });

    expect(prompt).toContain("Tallarines secos");
    expect(prompt).toContain("Pasta larga seca, sin salsa");
    expect(prompt).toContain("plato servido");
    expect(prompt).toContain("No agregues ni quites objetos");
  });

  it("arma una foto de catálogo desde la descripción", () => {
    const prompt = buildProductImagePrompt({
      mode: "describe",
      productName: "Tomate perita",
      productDescription: null,
      instruction: "Rojo intenso, piel lisa",
      style: "clean_catalog",
      touches: ["natural_light", "close_up"],
    });

    expect(prompt).toContain("Rojo intenso, piel lisa");
    expect(prompt).toContain("catálogo limpio");
    expect(prompt).toContain("luz natural");
    expect(prompt).toContain("primer plano");
    expect(prompt).toContain("No inventes marcas");
  });
});

describe("imageUsageDay", () => {
  it("corta el día en horario de Buenos Aires", () => {
    expect(imageUsageDay(new Date("2026-08-04T02:30:00.000Z"))).toBe("2026-08-03");
    expect(imageUsageDay(new Date("2026-08-04T03:30:00.000Z"))).toBe("2026-08-04");
  });
});

describe("decodeGeneratedImageCandidate", () => {
  it("acepta únicamente WebP base64 dentro del límite", () => {
    const bytes = Buffer.from("webp");
    expect(decodeGeneratedImageCandidate(`data:image/webp;base64,${bytes.toString("base64")}`)).toEqual(bytes);
    expect(decodeGeneratedImageCandidate(`data:image/png;base64,${bytes.toString("base64")}`)).toBeNull();
    expect(decodeGeneratedImageCandidate("data:image/webp;base64,%%%")).toBeNull();
  });
});
