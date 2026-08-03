import { describe, expect, it } from "vitest";

import { ProductKind, Unit, Vertical } from "@/generated/prisma/enums";
import { verticalPreset } from "@/lib/vertical";

import { presetCatalogFor } from "./preset-catalog";

describe("presetCatalogFor — verdulería", () => {
  const catalog = presetCatalogFor(Vertical.GROCERY);

  it("trae el catálogo de rubro completo, no los seis de ejemplo", () => {
    expect(catalog.length).toBeGreaterThan(100);
  });

  // Decisión del dueño: se siembra sin precio. Inventar un precio de referencia
  // es plata perdida en cada venta, y con la inflación queda viejo en un mes.
  it("todos entran sin precio, para que los ponga el negocio", () => {
    expect(catalog.every((item) => item.price === 0)).toBe(true);
  });

  // Sin esto el sembrado los crea como SERVICE y no descuentan stock: una
  // verdulería vendería tomates sin que baje nunca la existencia.
  it("son mercadería, no servicios", () => {
    expect(catalog.every((item) => item.kind === ProductKind.GOOD)).toBe(true);
  });

  it("cada uno trae su slug, que es lo que le da la foto compartida", () => {
    expect(catalog.every((item) => Boolean(item.catalogSlug))).toBe(true);
  });

  it("conserva la unidad de venta del catálogo", () => {
    expect(catalog.find((item) => item.catalogSlug === "tomate")).toMatchObject({ unit: Unit.KG });
    expect(catalog.find((item) => item.catalogSlug === "acelga")).toMatchObject({ unit: Unit.UNIT });
  });

  // `seedPresetCatalog` es idempotente por nombre en minúscula: dos productos
  // que se llamen igual se pisan y solo se crea uno. Con 122 ítems eso pasaría
  // sin que nadie lo note.
  it("no hay dos productos con el mismo nombre", () => {
    const names = catalog.map((item) => item.name.toLowerCase());
    const duplicados = names.filter((name, index) => names.indexOf(name) !== index);

    expect(duplicados).toEqual([]);
  });
});

describe("presetCatalogFor — el resto de los rubros", () => {
  it("no se toca: sigue devolviendo el catálogo del preset", () => {
    expect(presetCatalogFor(Vertical.KIOSK)).toEqual(verticalPreset(Vertical.KIOSK).catalog);
    expect(presetCatalogFor(Vertical.BARBERSHOP)).toEqual(verticalPreset(Vertical.BARBERSHOP).catalog);
  });

  it("los otros rubros sí traen precio de ejemplo", () => {
    expect(presetCatalogFor(Vertical.KIOSK).every((item) => item.price > 0)).toBe(true);
  });
});
