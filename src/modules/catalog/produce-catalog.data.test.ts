import { describe, expect, it } from "vitest";

import { Unit, Vertical } from "@/generated/prisma/enums";
import { verticalPreset } from "@/lib/vertical";

import { PRODUCE_CATALOG, findProduceItem } from "./produce-catalog.data";

describe("PRODUCE_CATALOG — invariantes que rompen en silencio", () => {
  // El slug ES el nombre del archivo de imagen compartido. Dos productos con el
  // mismo slug son dos productos mostrando la misma foto, y nadie se entera
  // hasta que un cliente ve un zapallo en la ficha del zapallito.
  it("no hay dos productos con el mismo slug", () => {
    const slugs = PRODUCE_CATALOG.map((item) => item.slug);
    const duplicados = slugs.filter((slug, index) => slugs.indexOf(slug) !== index);

    expect(duplicados).toEqual([]);
  });

  // El slug viaja en una URL (`/catalog/produce/<slug>.webp`) y es un nombre de
  // archivo. Un acento o un espacio ahí es un 404 en producción.
  it("todos los slugs son seguros para URL y para nombre de archivo", () => {
    const invalidos = PRODUCE_CATALOG.filter((item) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug));

    expect(invalidos.map((item) => item.slug)).toEqual([]);
  });

  it("ningún nombre viene vacío ni con espacios de más", () => {
    const sucios = PRODUCE_CATALOG.filter((item) => item.name.trim() !== item.name || item.name === "");

    expect(sucios.map((item) => item.slug)).toEqual([]);
  });

  // Si el catálogo trae una categoría que el alta del negocio no crea, al
  // sembrar aparece una categoría huérfana o el producto queda sin clasificar.
  it("toda categoría del catálogo la crea el preset de verdulería", () => {
    const delPreset = new Set(verticalPreset(Vertical.GROCERY).categories);
    const faltantes = [...new Set(PRODUCE_CATALOG.map((item) => item.category))].filter(
      (category) => !delPreset.has(category),
    );

    expect(faltantes).toEqual([]);
  });

  // Regla del rubro: ninguna aromática se pesa, van todas en atado.
  it("las aromáticas se venden por unidad, nunca por kilo", () => {
    const pesadas = PRODUCE_CATALOG.filter((item) => item.category === "Aromáticas" && item.unit !== Unit.UNIT);

    expect(pesadas.map((item) => item.slug)).toEqual([]);
  });
});

describe("findProduceItem", () => {
  it("encuentra por slug", () => {
    expect(findProduceItem("tomate-perita")).toMatchObject({ name: "Tomate perita", unit: Unit.KG });
  });

  it("devuelve undefined si no existe", () => {
    expect(findProduceItem("no-existe")).toBeUndefined();
  });
});
