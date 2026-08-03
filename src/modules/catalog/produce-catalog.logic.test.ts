import { describe, expect, it } from "vitest";

import { Unit } from "@/generated/prisma/enums";

import { buildProduceCatalog, parseProduceItem, toSlug } from "./produce-catalog.logic";

// Ayuda para leer los casos: solo nos interesa el item, no el envoltorio.
function item(rawName: string, categories: string[]) {
  const result = parseProduceItem(rawName, categories);
  if (result.kind !== "item") throw new Error(`Se esperaba un item, vino skip: ${result.reason}`);
  return result.item;
}

function skip(rawName: string, categories: string[]) {
  const result = parseProduceItem(rawName, categories);
  if (result.kind !== "skip") throw new Error(`Se esperaba skip, vino item: ${result.item.name}`);
  return result.reason;
}

describe("toSlug", () => {
  it("saca acentos y deja un identificador de archivo", () => {
    expect(toSlug("Morrón amarillo")).toBe("morron-amarillo");
    expect(toSlug("Repollitos de Bruselas")).toBe("repollitos-de-bruselas");
    expect(toSlug("Ají picante")).toBe("aji-picante");
  });
});

describe("parseProduceItem — la unidad viene escondida en el nombre", () => {
  // Sin sufijo, una verdulería vende por peso. Es el caso más común y por eso
  // es el default.
  it("sin sufijo es por kilo", () => {
    expect(item("Papa negra", ["verdura"])).toMatchObject({ name: "Papa negra", unit: Unit.KG });
  });

  it("'1 atado' es una unidad, y el atado se borra del nombre", () => {
    expect(item("Lechuga francesa 1 atado", ["verdura", "hojas"])).toMatchObject({
      name: "Lechuga francesa",
      unit: Unit.UNIT,
    });
  });

  it("'por atado' y 'ramo'/'ramito' también son unidad", () => {
    expect(item("Kale por atado", ["verdura"])).toMatchObject({ name: "Kale", unit: Unit.UNIT });
    expect(item("Romero ramo", ["hierbas-aromaticas"])).toMatchObject({ name: "Romero", unit: Unit.UNIT });
    expect(item("Perejil ramito", ["hierbas-aromaticas"])).toMatchObject({ name: "Perejil", unit: Unit.UNIT });
  });

  it("'por unidad' en cualquiera de sus formas", () => {
    expect(item("Morrón amarillo por unidad", ["verdura"])).toMatchObject({
      name: "Morrón amarillo",
      unit: Unit.UNIT,
    });
    expect(item("Palta 1 unidad mediana", ["verdura"])).toMatchObject({ name: "Palta", unit: Unit.UNIT });
    expect(item("Granada 1 unidad", ["fruta"])).toMatchObject({ name: "Granada", unit: Unit.UNIT });
  });

  // Una bandeja de champiñones se vende cerrada: es una unidad, no 200 gramos
  // sueltos que el cliente pueda pedir a 150.
  it("un peso fijo en el nombre es una bandeja, o sea una unidad", () => {
    expect(item("Champignones 200g", ["verdura"])).toMatchObject({ unit: Unit.UNIT });
    expect(item("Repollitos de bruselas 400g", ["verdura", "hojas"])).toMatchObject({
      name: "Repollitos de Bruselas",
      unit: Unit.UNIT,
    });
    expect(item("Jengibre 250 gr", ["hierbas-aromaticas", "verdura"])).toMatchObject({
      name: "Jengibre",
      unit: Unit.UNIT,
    });
  });

  it("'(bandejita)' es unidad y el paréntesis no queda en el nombre", () => {
    expect(item("Brotes de alfalfa (bandejita)", ["verdura", "hojas", "listo-para-usar"])).toMatchObject({
      name: "Brotes de alfalfa",
      unit: Unit.UNIT,
    });
  });

  it("el token de unidad se saca aunque esté en el medio", () => {
    expect(item("Albahaca 1 atado común", ["verdura", "hojas"])).toMatchObject({ name: "Albahaca común" });
  });
});

describe("parseProduceItem — categorías", () => {
  it("mapea las categorías del origen a las de la app", () => {
    expect(item("Banana", ["fruta"])).toMatchObject({ category: "Frutas", unit: Unit.KG });
    expect(item("Tomate Perita", ["verdura"])).toMatchObject({ category: "Verduras" });
    expect(item("Menta", ["hierbas-aromaticas"])).toMatchObject({ category: "Aromáticas" });
  });

  // "Hojas" y "Listo para usar" son merchandising del origen: lechuga está en
  // "verdura" Y en "hojas". Para nosotros es una verdura y punto.
  it("cuando cae en varias, verdura le gana a hojas", () => {
    expect(item("Espinaca 1 atado", ["verdura", "hojas"])).toMatchObject({ category: "Verduras" });
  });

  // El origen mete albahaca y ciboulette en "verdura". Son aromáticas: el
  // verdulero las tiene juntas y en atado, no en el cajón de las papas.
  it("una aromática es aromática aunque el origen la haya puesto en verdura", () => {
    expect(item("Albahaca 1 atado común", ["verdura", "hojas"])).toMatchObject({ category: "Aromáticas" });
    expect(item("Ciboulette Hidroponico 1 atado", ["verdura"])).toMatchObject({ category: "Aromáticas" });
  });

  it("los huevos no son una verdura", () => {
    expect(item("Maple de huevos Blanco", ["verdura"])).toMatchObject({ category: "Huevos y lácteos" });
  });
});

describe("parseProduceItem — lo que no entra al catálogo", () => {
  it("descarta promos, que son del negocio y no del rubro", () => {
    expect(skip("PROMO Zanahoria bolsa chica", ["verdura"])).toMatch(/promo/i);
  });

  it("descarta preparados propios del local", () => {
    expect(skip("Verdura para sopa (bandejita)", ["verdura", "listo-para-usar"])).toMatch(/preparado/i);
    expect(skip("Anco cortado en bandeja 250g aprox.", ["verdura", "listo-para-usar"])).toMatch(/preparado/i);
  });

  it("descarta envasados de marca colados en aromáticas", () => {
    expect(skip("Yerba Larga Vida Orgánica x 500gr", ["hierbas-aromaticas"])).toMatch(/marca/i);
  });

  it("descarta lo que no es fruta ni verdura", () => {
    expect(skip("Barra Proteica B3ST Naranja x 10 Barritas", ["almacen", "cereales-granolas-y-galletitas"])).toMatch(
      /categor/i,
    );
  });
});

describe("parseProduceItem — la unidad por defecto depende del rubro", () => {
  // Ninguna aromática se vende al peso: van en atado o en maceta. Que "Menta"
  // no traiga sufijo no la convierte en algo que se pese.
  it("una aromática sin sufijo es una unidad, no un kilo", () => {
    expect(item("Menta", ["hierbas-aromaticas"])).toMatchObject({ name: "Menta", unit: Unit.UNIT });
  });

  it("un maple de huevos es una unidad", () => {
    expect(item("Maple de huevos Blanco", ["verdura"])).toMatchObject({ unit: Unit.UNIT });
  });

  it("pero una verdura sin sufijo sigue siendo por kilo", () => {
    expect(item("Zanahoria", ["verdura"])).toMatchObject({ unit: Unit.KG });
  });
});

describe("parseProduceItem — nombres canónicos", () => {
  // El origen escribe en Title Case de e-commerce. En el mostrador se lee mejor
  // en minúscula, y es lo que ya usa el resto del catálogo.
  it("baja a minúscula todo menos la primera palabra", () => {
    expect(item("Cebolla Morada", ["verdura"])).toMatchObject({ name: "Cebolla morada" });
    expect(item("Tomate Cherry", ["verdura"])).toMatchObject({ name: "Tomate cherry" });
    expect(item("Uvas Negras", ["fruta"])).toMatchObject({ name: "Uvas negras" });
  });

  it("respeta los nombres propios", () => {
    expect(item("Repollitos de bruselas 400g", ["verdura"])).toMatchObject({ name: "Repollitos de Bruselas" });
  });

  it("corrige la ortografía del origen", () => {
    expect(item("Melon Amarillo", ["fruta"])).toMatchObject({ name: "Melón amarillo" });
    expect(item("Brocoli por unidad", ["verdura"])).toMatchObject({ name: "Brócoli" });
  });
});

describe("parseProduceItem — una especia envasada no es una aromática", () => {
  // El nombre solo desempata DENTRO de la verdulería. "Perejil en Frasco BADIA"
  // vive en `especias` junto al pimentón: es almacén, y en el catálogo de una
  // verdulería no va.
  it("descarta frascos de marca aunque se llamen como una hierba", () => {
    expect(skip("Orégano Alicante", ["almacen", "especias"])).toMatch(/categor/i);
    expect(skip("Perejil en Frasco BADIA", ["almacen", "especias"])).toMatch(/categor/i);
    expect(skip("Hojas de Laurel", ["almacen", "especias"])).toMatch(/categor/i);
  });

  it("pero la hierba fresca del cajón sigue entrando", () => {
    expect(item("Perejil ramito", ["hierbas-aromaticas"])).toMatchObject({ category: "Aromáticas" });
    expect(item("Albahaca 1 atado común", ["verdura", "hojas"])).toMatchObject({ category: "Aromáticas" });
  });
});

describe("buildProduceCatalog", () => {
  it("junta, deduplica por slug y ordena", () => {
    const catalog = buildProduceCatalog([
      { name: "Tomate", categories: ["verdura"] },
      { name: "Banana", categories: ["fruta"] },
      // La misma lechuga llega dos veces porque está en dos categorías del origen.
      { name: "Lechuga criolla 1 atado", categories: ["verdura"] },
      { name: "Lechuga criolla 1 atado", categories: ["hojas"] },
      { name: "PROMO lo que sea", categories: ["verdura"] },
    ]);

    expect(catalog.map((entry) => entry.slug)).toEqual(["banana", "lechuga-criolla", "tomate"]);
  });

  it("no deja dos productos distintos pisándose el mismo archivo de imagen", () => {
    const catalog = buildProduceCatalog([
      { name: "Tomate", categories: ["verdura"] },
      { name: "Tomate Cherry", categories: ["verdura"] },
      { name: "Tomate Perita", categories: ["verdura"] },
    ]);

    expect(new Set(catalog.map((entry) => entry.slug)).size).toBe(catalog.length);
  });
});
