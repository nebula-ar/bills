// Normalización del catálogo de verdulería.
//
// Una verdulería vende siempre lo mismo: tomate, papa, lechuga, banana. Por eso
// el catálogo se puede sembrar de fábrica y el dueño no tiene que cargar 150
// productos ni fotografiar una banana. Este archivo convierte una lista cruda
// —scrapeada de una verdulería online— en ese catálogo canónico.
//
// El origen es un e-commerce, y un e-commerce piensa distinto que un verdulero:
//   - mete la unidad de venta adentro del nombre ("Lechuga francesa 1 atado");
//   - arma categorías de vidriera ("Hojas", "Listo para usar") que se pisan
//     entre sí;
//   - mezcla sus promos y sus preparados con el producto de rubro.
//
// Acá solo vive lo que se puede probar sin red. Bajar los datos es tarea del
// script; decidir qué es un producto de verdulería y cómo se llama, es de acá.

import { Unit } from "@/generated/prisma/enums";

export type ProduceCategory = "Frutas" | "Verduras" | "Aromáticas" | "Huevos y lácteos";

export type ProduceItem = {
  // Identifica la foto compartida: todas las verdulerías leen la misma
  // `banana.webp`. Por eso el slug tiene que ser único e irrepetible.
  slug: string;
  name: string;
  unit: Unit;
  category: ProduceCategory;
};

export type RawProduct = {
  name: string;
  // Slugs de categoría tal como vienen del origen.
  categories: string[];
};

export type ParseResult = { kind: "item"; item: ProduceItem } | { kind: "skip"; reason: string };

export function toSlug(name: string): string {
  return plain(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ── Unidad de venta ──────────────────────────────────────────────────────────
//
// El sufijo del nombre es la única señal que da el origen. Sin sufijo se vende
// por peso, que es el caso más común en una verdulería y por eso es el default.
// Cada patrón se borra del nombre: al catálogo va "Lechuga francesa", no
// "Lechuga francesa 1 atado".
const UNIT_PATTERNS: RegExp[] = [
  // "1 atado", "por atado", "atado"
  /\b(?:1\s+|por\s+)?atado\b/gi,
  // "ramo", "ramito"
  /\bram(?:it)?o\b/gi,
  // "por unidad", "1 unidad mediana", "1 unidad"
  /\b(?:por|1)\s+unidad(?:\s+(?:mediana|chica|grande))?\b/gi,
  // "(bandejita)"
  /\(\s*bandejita\s*\)/gi,
  // Un peso fijo: "200g", "500gr", "250 gr". Es una bandeja cerrada, se vende
  // entera; el cliente no puede pedir 150 de una bandeja de 200.
  /\b\d+\s*gr?\b/gi,
];

// ── Aromáticas ───────────────────────────────────────────────────────────────
//
// El origen mete albahaca y ciboulette en "verdura". El verdulero no: las tiene
// juntas, en atado, al lado del perejil. La categoría del origen no manda sobre
// esto.
const HERBS = [
  "albahaca",
  "ciboulette",
  "cilantro",
  "eneldo",
  "estragon",
  "laurel",
  "menta",
  "oregano",
  "perejil",
  "romero",
  "salvia",
  "tomillo",
];

const EGGS = ["huevo", "maple de huevos"];

// Prioridad al mapear: un producto del origen cae en varias categorías a la vez
// (lechuga está en "verdura" y en "hojas"). Gana la primera que matchea.
const CATEGORY_BY_SOURCE: Array<{ slugs: string[]; category: ProduceCategory }> = [
  { slugs: ["fruta"], category: "Frutas" },
  { slugs: ["verdura", "hojas", "listo-para-usar"], category: "Verduras" },
  { slugs: ["hierbas-aromaticas"], category: "Aromáticas" },
];

// ── Lo que no entra ──────────────────────────────────────────────────────────
//
// Explícito a propósito. Una regla difusa ("descartar todo lo que diga bandeja")
// se llevaría puestos los brotes, que sí son de rubro. Preferimos una lista que
// se pueda leer y discutir.
const PREPARED = ["verdura para sopa", "cortado en bandeja", "cortada en bandeja"];

// Envasados de marca colados entre las aromáticas: yerba, té, especias en
// frasco. Son almacén, no verdulería.
const BRANDED = ["yerba", "larga vida", " x 500gr", "infusion"];

// Nombres propios que sobreviven al pasaje a minúscula.
const PROPER_NOUNS = ["bruselas"];

// Correcciones de ortografía del origen. Es data, no regla: explícita y
// revisable. Un catálogo que se le muestra a 300 clientes escribe "ananá" bien.
const NAME_FIXES: Record<string, string> = {
  anana: "Ananá",
  "aji picante": "Ají picante",
  brocoli: "Brócoli",
  cabutia: "Cabutiá",
  champignones: "Champiñones",
  "ciboulette hidroponico": "Ciboulette",
  "melon amarillo": "Melón amarillo",
  "melon blanco": "Melón blanco",
  sandia: "Sandía",
  "sandia baby entera": "Sandía baby",
};

export function parseProduceItem(rawName: string, categories: string[]): ParseResult {
  const raw = rawName.replace(/\s+/g, " ").trim();
  const lower = plain(raw);

  // Una promo es del negocio, no del rubro: "PROMO Zanahoria bolsa chica" no es
  // un producto que otra verdulería quiera en su catálogo.
  if (/^promo\b/i.test(raw)) {
    return { kind: "skip", reason: "Es una promo del local, no un producto del rubro" };
  }

  if (PREPARED.some((needle) => lower.includes(plain(needle)))) {
    return { kind: "skip", reason: "Es un preparado propio del local" };
  }

  if (BRANDED.some((needle) => lower.includes(plain(needle)))) {
    return { kind: "skip", reason: "Es un envasado de marca, no producto de verdulería" };
  }

  const category = resolveCategory(raw, categories);

  if (!category) {
    return { kind: "skip", reason: "No cae en ninguna categoría de verdulería" };
  }

  const { name, unit } = stripUnit(raw, category);

  if (!name) {
    return { kind: "skip", reason: "Se quedó sin nombre al limpiar la unidad" };
  }

  return { kind: "item", item: { slug: toSlug(name), name: canonicalName(name), unit, category } };
}

// Arma el catálogo final: descarta lo que no va, deduplica y ordena.
//
// La deduplicación no es un detalle: el origen devuelve la misma lechuga una vez
// por cada categoría en la que la puso. Y como el slug es el nombre del archivo
// de imagen compartido, dos productos con el mismo slug serían dos productos
// mostrando la misma foto.
export function buildProduceCatalog(products: RawProduct[]): ProduceItem[] {
  const bySlug = new Map<string, ProduceItem>();

  for (const product of products) {
    const result = parseProduceItem(product.name, product.categories);

    if (result.kind === "item" && !bySlug.has(result.item.slug)) {
      bySlug.set(result.item.slug, result.item);
    }
  }

  return [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}

function resolveCategory(raw: string, categories: string[]): ProduceCategory | null {
  const slugs = categories.map((slug) => slug.toLowerCase());

  const fromSource = CATEGORY_BY_SOURCE.find(({ slugs: sources }) =>
    sources.some((source) => slugs.includes(source)),
  )?.category;

  // Primero tiene que ser de la verdulería. El nombre solo desempata adentro:
  // "Perejil en Frasco BADIA" vive en `especias`, al lado del pimentón, y por
  // más que se llame perejil es almacén.
  if (!fromSource) return null;

  const lower = plain(raw);

  if (EGGS.some((needle) => lower.includes(plain(needle)))) return "Huevos y lácteos";
  if (HERBS.some((needle) => lower.includes(needle))) return "Aromáticas";

  return fromSource;
}

// La unidad por defecto la manda el rubro, no el origen. Una verdura sin sufijo
// se pesa; una aromática, jamás: va en atado. Y un maple de huevos es un maple.
const DEFAULT_UNIT: Record<ProduceCategory, Unit> = {
  Frutas: Unit.KG,
  Verduras: Unit.KG,
  Aromáticas: Unit.UNIT,
  "Huevos y lácteos": Unit.UNIT,
};

function stripUnit(raw: string, category: ProduceCategory): { name: string; unit: Unit } {
  let name = raw;
  let unit: Unit = DEFAULT_UNIT[category];

  for (const pattern of UNIT_PATTERNS) {
    // Los patrones son globales y se reusan entre llamadas: sin esto, `lastIndex`
    // se arrastra y el segundo producto que matchea el mismo patrón se escapa.
    pattern.lastIndex = 0;

    if (pattern.test(name)) {
      unit = Unit.UNIT;
      pattern.lastIndex = 0;
      name = name.replace(pattern, " ");
    }
  }

  // "aprox.", puntuación suelta y espacios dobles que deja la limpieza.
  name = name
    .replace(/\baprox\.?\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/[\s.,-]+$/, "")
    .trim();

  return { name, unit };
}

// El origen escribe "Cebolla Morada" en Title Case de vidriera. En el mostrador
// se lee mejor "Cebolla morada", que además es como está escrito el resto del
// catálogo de la app.
function canonicalName(name: string): string {
  const sentenceCased = name
    .split(" ")
    .map((word, index) => {
      if (index === 0) return word;
      // El origen escribe "de bruselas" en minúscula: no alcanza con dejarlo
      // como vino, hay que ponerlo en mayúscula.
      if (PROPER_NOUNS.includes(plain(word))) return word[0].toUpperCase() + word.slice(1).toLowerCase();
      return word.toLowerCase();
    })
    .join(" ");

  // Las correcciones explícitas van al final: si una está listada, gana sobre
  // cualquier regla.
  return NAME_FIXES[plain(sentenceCased)] ?? sentenceCased;
}

function plain(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}
