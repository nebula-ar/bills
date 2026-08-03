import { describe, expect, it } from "vitest";

import { CATALOG_IMAGE_BASE, productImageSrc } from "./product-image-src.logic";

const OWN_PHOTO = 1_754_128_800_000;

describe("productImageSrc", () => {
  // La foto que sacó el dueño gana siempre. Si se tomó el trabajo de fotografiar
  // SU tomate, es porque el genérico no le servía.
  it("la foto propia del negocio le gana a la del catálogo", () => {
    expect(productImageSrc({ id: "p1", imageVersion: OWN_PHOTO, catalogSlug: "tomate" })).toBe(
      `/api/products/p1/image?v=${OWN_PHOTO}`,
    );
  });

  it("sin foto propia, usa la imagen compartida del catálogo", () => {
    expect(productImageSrc({ id: "p1", imageVersion: null, catalogSlug: "tomate" })).toBe(
      `${CATALOG_IMAGE_BASE}/tomate.webp`,
    );
  });

  it("sin foto propia ni slug, no hay imagen y quien llama muestra el placeholder", () => {
    expect(productImageSrc({ id: "p1", imageVersion: null, catalogSlug: null })).toBeNull();
  });

  // El `?v=` es lo que hace que se vea la foto nueva al toque: la ruta de la
  // imagen se sirve con caché inmutable, así que sin cambiar la URL el navegador
  // seguiría mostrando la vieja.
  it("la foto propia versiona por fecha para romper el caché", () => {
    expect(productImageSrc({ id: "p1", imageVersion: OWN_PHOTO, catalogSlug: null })).not.toBe(
      productImageSrc({ id: "p1", imageVersion: OWN_PHOTO + 1000, catalogSlug: null }),
    );
  });

  // La imagen del catálogo NO lleva versión: es inmutable por definición y la
  // comparten todos los negocios. Que la cachee el navegador para siempre es
  // exactamente lo que queremos.
  it("la imagen del catálogo no lleva versión", () => {
    expect(productImageSrc({ id: "p1", imageVersion: null, catalogSlug: "banana" })).not.toContain("?");
  });
});

describe("productImageSrc — página pública", () => {
  // La página pública no tiene sesión: la foto propia sale por la ruta con
  // token, que revalida contra el negocio dueño del token.
  it("con token, la foto propia sale por la ruta pública", () => {
    expect(
      productImageSrc({ id: "p1", imageVersion: OWN_PHOTO, catalogSlug: "tomate" }, { publicToken: "abc123" }),
    ).toBe(`/api/public/abc123/products/p1/image?v=${OWN_PHOTO}`);
  });

  // La del catálogo es un archivo estático: no depende del negocio ni necesita
  // autorización, así que es la misma URL adentro y afuera.
  it("la del catálogo es la misma adentro y afuera", () => {
    const inside = productImageSrc({ id: "p1", imageVersion: null, catalogSlug: "banana" });
    const outside = productImageSrc({ id: "p1", imageVersion: null, catalogSlug: "banana" }, { publicToken: "abc" });

    expect(outside).toBe(inside);
  });
});
