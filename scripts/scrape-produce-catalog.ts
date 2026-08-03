// Baja la taxonomía de una verdulería online y la normaliza al catálogo
// canónico de Bills.
//
// Se corre a mano, no en runtime:
//
//   npx tsx scripts/scrape-produce-catalog.ts
//
// Deja `scripts/produce-catalog.generated.json` para revisar ANTES de commitear.
// Nada de esto se ejecuta en producción: es una herramienta de una sola vez para
// armar la lista de productos que después vive en el código.
//
// Qué se toma y qué no: se toman los NOMBRES y las CATEGORÍAS —qué vende una
// verdulería y cómo se agrupa— que son datos del rubro. Las fotos NO: son del
// origen y se resuelven aparte, contra bancos de imágenes de licencia libre.

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildProduceCatalog, parseProduceItem, type RawProduct } from "../src/modules/catalog/produce-catalog.logic";

const SOURCE = "https://verdepuro.com.ar";
const PER_PAGE = 100;

// Cortesía mínima con el origen: que sepan quién los está consultando.
const USER_AGENT = "Bills-CatalogBootstrap/1.0 (+catálogo de rubro; contacto: barbysanabria5@gmail.com)";

type StoreProduct = {
  name: string;
  categories: Array<{ slug: string }>;
};

async function fetchPage(page: number): Promise<{ products: StoreProduct[]; totalPages: number }> {
  const url = `${SOURCE}/wp-json/wc/store/v1/products?per_page=${PER_PAGE}&page=${page}`;
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`El origen respondió ${response.status} en la página ${page}`);
  }

  return {
    products: (await response.json()) as StoreProduct[],
    totalPages: Number(response.headers.get("x-wp-totalpages") ?? 1),
  };
}

async function main() {
  const first = await fetchPage(1);
  const raw: StoreProduct[] = [...first.products];

  for (let page = 2; page <= first.totalPages; page++) {
    const next = await fetchPage(page);
    raw.push(...next.products);
  }

  const products: RawProduct[] = raw.map((product) => ({
    name: product.name,
    categories: product.categories.map((category) => category.slug),
  }));

  const catalog = buildProduceCatalog(products);

  // El descarte se informa, no se esconde. Si el parser se come algo que sí era
  // del rubro, tiene que ser visible acá y no aparecer como un hueco silencioso
  // en el catálogo tres meses después.
  const skipped = products
    .map((product) => ({ name: product.name, result: parseProduceItem(product.name, product.categories) }))
    .filter((entry) => entry.result.kind === "skip")
    .map((entry) => ({ name: entry.name, reason: entry.result.kind === "skip" ? entry.result.reason : "" }));

  const byReason = new Map<string, number>();
  for (const entry of skipped) byReason.set(entry.reason, (byReason.get(entry.reason) ?? 0) + 1);

  const byCategory = new Map<string, number>();
  for (const entry of catalog) byCategory.set(entry.category, (byCategory.get(entry.category) ?? 0) + 1);

  const outPath = resolve(import.meta.dirname, "produce-catalog.generated.json");
  writeFileSync(outPath, `${JSON.stringify({ source: SOURCE, catalog, skipped }, null, 2)}\n`, "utf8");

  console.log(`Origen:      ${SOURCE}`);
  console.log(`Bajados:     ${products.length} productos`);
  console.log(`Al catálogo: ${catalog.length}`);
  for (const [category, count] of [...byCategory].sort()) console.log(`  ${category.padEnd(18)} ${count}`);
  console.log(`Descartados: ${skipped.length}`);
  for (const [reason, count] of [...byReason].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(3)}  ${reason}`);
  }
  console.log(`\nEscrito en ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
