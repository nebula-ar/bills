import { describe, expect, it } from "vitest";

import { ProductKind, Unit, Vertical } from "@/generated/prisma/enums";
import { verticalPreset } from "@/lib/vertical";

import { presetCatalogFor } from "./preset-catalog";

describe("presetCatalogFor — verdulería", () => {
  const catalog = presetCatalogFor(Vertical.GROCERY);

  it("trae el catálogo de rubro completo, no los seis de ejemplo", () => {
    expect(catalog.length).toBeGreaterThan(100);
  });

  // Sin precio el producto no llega al mostrador: la lista de venta se arma
  // desde los precios de la sucursal. Uno solo sin precio es un producto que el
  // negocio cree tener cargado y no puede vender.
  it("todos tienen precio de referencia", () => {
    const sinPrecio = catalog.filter((item) => item.price <= 0);

    expect(sinPrecio.map((item) => item.catalogSlug)).toEqual([]);
  });

  // Los seis que ya vivían en el preset son el ancla de la que se derivó el
  // resto: si alguien los mueve, el resto queda desalineado.
  it("respeta los precios que ya existían", () => {
    expect(catalog.find((item) => item.catalogSlug === "banana")).toMatchObject({ price: 2400 });
    expect(catalog.find((item) => item.catalogSlug === "tomate")).toMatchObject({ price: 2900 });
    expect(catalog.find((item) => item.catalogSlug === "huevos-por-docena")).toMatchObject({ price: 5200 });
  });

  // Un precio en pesos enteros: la app no maneja centavos (ver src/lib/money.ts).
  it("los precios son enteros en pesos", () => {
    expect(catalog.every((item) => Number.isInteger(item.price))).toBe(true);
  });

  // Existencia inventada NO. Sembrarla asienta un movimiento INITIAL: el libro
  // diciendo que entró mercadería que nunca entró. Infla el patrimonio del
  // dashboard y el primer conteo real aparece como faltante, que es pérdida.
  it("no siembra existencia", () => {
    expect(catalog.every((item) => !item.stock)).toBe(true);
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
