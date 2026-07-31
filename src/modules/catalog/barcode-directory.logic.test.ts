import { describe, expect, it } from "vitest";

import { buildDirectoryName, isAllowedImageUrl, isLookupableBarcode } from "./barcode-directory.logic";

describe("isLookupableBarcode", () => {
  it("acepta los códigos que existen en las bases mundiales", () => {
    expect(isLookupableBarcode("7790040991002")).toBe(true); // EAN-13
    expect(isLookupableBarcode("77901234")).toBe(true); // EAN-8
    expect(isLookupableBarcode("012345678905")).toBe(true); // UPC-A
  });

  it("descarta los códigos internos del negocio", () => {
    // La etiqueta que imprime la balanza o el "444" de la verdulería no está en
    // ninguna base pública: consultarlo sería hacer esperar al cliente al pedo.
    expect(isLookupableBarcode("444")).toBe(false);
    expect(isLookupableBarcode("ALF-01")).toBe(false);
    expect(isLookupableBarcode("")).toBe(false);
  });
});

describe("buildDirectoryName", () => {
  it("junta marca, producto y contenido", () => {
    expect(buildDirectoryName({ productName: "Gaseosa cola", brands: "Coca-Cola", quantity: "1,5 L" })).toBe(
      "Coca-Cola Gaseosa cola 1,5 L",
    );
  });

  it("no repite la marca si ya está en el nombre", () => {
    expect(buildDirectoryName({ productName: "Coca Cola Zero", brands: "Coca-Cola" })).toBe("Coca Cola Zero");
  });

  it("no repite el contenido si ya está en el nombre", () => {
    expect(buildDirectoryName({ productName: "Agua mineral 500 ml", brands: null, quantity: "500 ml" })).toBe(
      "Agua mineral 500 ml",
    );
  });

  it("sin nombre no hay sugerencia, por más marca que traiga", () => {
    expect(buildDirectoryName({ productName: "", brands: "Arcor" })).toBeNull();
    expect(buildDirectoryName({ productName: null })).toBeNull();
  });
});

describe("isAllowedImageUrl", () => {
  it("acepta las imágenes de las bases que consultamos", () => {
    expect(isAllowedImageUrl("https://images.openfoodfacts.org/images/products/779/0.jpg")).toBe(true);
    expect(isAllowedImageUrl("https://world.openbeautyfacts.org/images/x.jpg")).toBe(true);
  });

  it("rechaza cualquier otro destino", () => {
    // La URL sale de una respuesta ajena: si no se acota, el servidor termina
    // pidiendo direcciones que nadie eligió.
    expect(isAllowedImageUrl("https://ejemplo.com/foto.jpg")).toBe(false);
    expect(isAllowedImageUrl("http://images.openfoodfacts.org/x.jpg")).toBe(false);
    expect(isAllowedImageUrl("https://openfoodfacts.org.malicioso.com/x.jpg")).toBe(false);
    expect(isAllowedImageUrl("no-es-una-url")).toBe(false);
  });
});
