// Baja las fotos del catálogo de verdulería desde Wikimedia Commons y las deja
// listas para servir.
//
//   npx tsx scripts/fetch-produce-images.ts          (solo lo que falta)
//   npx tsx scripts/fetch-produce-images.ts --force   (rehace todo)
//
// Escribe:
//   public/catalog/produce/<slug>.webp     512x512 WebP, la imagen compartida
//   public/catalog/produce/attribution.json  autor y licencia de cada una
//
// POR QUÉ COMMONS Y NO EL CATÁLOGO DE UNA VERDULERÍA ONLINE
// Estas imágenes se distribuyen como parte del producto: las lee cada negocio
// que usa la app. Las de un e-commerce son de ese e-commerce. Commons tiene
// licencia que permite uso comercial, y acá se guarda la atribución que cada
// una pide.
//
// POR QUÉ 512 CUADRADO
// Es exactamente lo que hace `saveProductImage` con las fotos que sube el dueño
// (ver product-image.use-case.ts). Si la del catálogo tuviera otro tamaño o
// recorte, la grilla del POS quedaría despareja según quién subió foto y quién no.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { PRODUCE_CATALOG } from "../src/modules/catalog/produce-catalog.data";
import { PRODUCE_IMAGE_PINS } from "./produce-image-pins";
import { PRODUCE_IMAGE_QUERIES } from "./produce-image-queries";

// Commons exige un User-Agent que identifique a quien consulta; con uno genérico
// devuelve 403.
const USER_AGENT = "Bills-CatalogBootstrap/1.0 (https://github.com/wmatias16/barber-bills; barbysanabria5@gmail.com)";

const API = "https://commons.wikimedia.org/w/api.php";
const OUT_DIR = resolve(import.meta.dirname, "../public/catalog/produce");
const SIDE = 512;

// GFDL obliga a incluir el texto completo de la licencia junto a la obra. Es
// usable pero incómodo para un ícono de catálogo, así que si hay alternativa se
// prefiere otra.
const AWKWARD_LICENSE = /gfdl/i;

type Candidate = {
  title: string;
  thumbUrl: string;
  descriptionUrl: string;
  artist: string;
  license: string;
  // De dónde salió, para poder auditar el manifiesto de un vistazo.
  source: "pin" | "wikipedia" | "commons";
};

type Attribution = Candidate & { slug: string; file: string };

function text(html: string | undefined): string {
  return (html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function search(query: string): Promise<Candidate[]> {
  const url = new URL(API);
  url.search = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    // namespace 6 = archivos; `filetype:bitmap` saca SVGs y diagramas.
    gsrsearch: `filetype:bitmap ${query}`,
    gsrnamespace: "6",
    gsrlimit: "8",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "1024",
  }).toString();

  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) throw new Error(`Commons respondió ${response.status}`);

  const body = (await response.json()) as {
    query?: { pages?: Record<string, Record<string, unknown>> };
  };

  const pages = Object.values(body.query?.pages ?? {});

  // El generator devuelve las páginas sin orden; `index` conserva el ranking de
  // relevancia de la búsqueda.
  pages.sort((a, b) => Number(a.index ?? 0) - Number(b.index ?? 0));

  return pages.flatMap((page) => {
    const info = (page.imageinfo as Array<Record<string, unknown>> | undefined)?.[0];
    const meta = (info?.extmetadata ?? {}) as Record<string, { value?: string }>;

    if (!info?.thumburl) return [];

    return [
      {
        title: String(page.title ?? ""),
        thumbUrl: String(info.thumburl),
        descriptionUrl: String(info.descriptionurl ?? ""),
        artist: text(meta.Artist?.value) || "Desconocido",
        license: text(meta.LicenseShortName?.value) || "Desconocida",
        source: "commons" as const,
      },
    ];
  });
}

// Datos de un archivo puntual de Commons, por título exacto ("File:Algo.jpg").
async function fileInfo(title: string, source: Candidate["source"]): Promise<Candidate | null> {
  const url = new URL(API);
  url.search = new URLSearchParams({
    action: "query",
    format: "json",
    titles: title,
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "1024",
  }).toString();

  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) return null;

  const body = (await response.json()) as { query?: { pages?: Record<string, Record<string, unknown>> } };
  const page = Object.values(body.query?.pages ?? {})[0];
  const info = (page?.imageinfo as Array<Record<string, unknown>> | undefined)?.[0];

  if (!info?.thumburl) return null;

  const meta = (info.extmetadata ?? {}) as Record<string, { value?: string }>;

  return {
    title: String(page?.title ?? title),
    thumbUrl: String(info.thumburl),
    descriptionUrl: String(info.descriptionurl ?? ""),
    artist: text(meta.Artist?.value) || "Desconocido",
    license: text(meta.LicenseShortName?.value) || "Desconocida",
    source,
  };
}

// La imagen de portada del artículo de Wikipedia.
//
// Es MUCHO mejor señal que el primer resultado de una búsqueda: la portada de
// un artículo la eligieron editores humanos para representar la cosa, así que
// es una foto del producto y no un pliego de herbario ni una lámina del 1800.
// Buscar "Prunus persica" en Commons devuelve cualquier cosa; el artículo de
// Wikipedia sobre Prunus persica tiene un durazno en la portada.
async function fromWikipedia(query: string): Promise<Candidate | null> {
  for (const lang of ["es", "en"]) {
    const url = new URL(`https://${lang}.wikipedia.org/w/api.php`);
    url.search = new URLSearchParams({
      action: "query",
      format: "json",
      generator: "search",
      gsrsearch: query,
      // namespace 0 = artículos, no categorías ni discusiones.
      gsrnamespace: "0",
      gsrlimit: "1",
      prop: "pageimages",
      piprop: "name",
    }).toString();

    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(20_000),
      });

      if (!response.ok) continue;

      const body = (await response.json()) as { query?: { pages?: Record<string, Record<string, unknown>> } };
      const page = Object.values(body.query?.pages ?? {})[0];
      const name = page?.pageimage;

      if (typeof name !== "string" || !name) continue;

      // Wikipedia devuelve el nombre del archivo; la licencia y el autor viven
      // en Commons, así que hay que ir a buscarlos ahí.
      const candidate = await fileInfo(`File:${name}`, "wikipedia");

      if (candidate) return candidate;
    } catch {
      // Un idioma que falla no invalida al otro.
    }
  }

  return null;
}

// Orden de preferencia: lo fijado a mano, después la portada de Wikipedia, y
// recién al final la búsqueda en Commons.
async function resolve1(slug: string, query: string): Promise<Candidate | null> {
  const pinned = PRODUCE_IMAGE_PINS[slug];

  if (pinned) {
    const candidate = await fileInfo(pinned, "pin");
    if (candidate) return candidate;
    console.log(`  ! ${slug}: el archivo fijado no existe (${pinned})`);
  }

  const fromWiki = await fromWikipedia(query);
  if (fromWiki) return fromWiki;

  const candidates = await search(query);
  if (candidates.length === 0) return null;

  return candidates.find((c) => !AWKWARD_LICENSE.test(c.license)) ?? candidates[0];
}

async function toSquareWebp(thumbUrl: string): Promise<Buffer> {
  const response = await fetch(thumbUrl, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) throw new Error(`La imagen respondió ${response.status}`);

  const original = Buffer.from(await response.arrayBuffer());
  const { default: sharp } = await import("sharp");

  return sharp(original, { failOn: "error" })
    .rotate()
    // Mismo recorte que las fotos que sube el dueño: al centro y cuadrado, para
    // que la grilla no quede despareja.
    //
    // Sin `withoutEnlargement` a propósito. Con esa opción, `cover` no agranda:
    // si el lado corto del original mide menos de 512 —pasa con las apaisadas,
    // que a 1024 de ancho quedan en 400 de alto— devuelve 512x400 y el recorte
    // deja de ser cuadrado. Una foto apenas escalada se nota mucho menos que un
    // renglón de la grilla más bajo que los otros.
    .resize(SIDE, SIDE, { fit: "cover", position: "centre" })
    .webp({ quality: 80 })
    .toBuffer();
}

async function main() {
  const force = process.argv.includes("--force");
  mkdirSync(OUT_DIR, { recursive: true });

  const attributions: Attribution[] = [];
  const failures: Array<{ slug: string; reason: string }> = [];
  let downloaded = 0;
  let skipped = 0;

  for (const item of PRODUCE_CATALOG) {
    const file = resolve(OUT_DIR, `${item.slug}.webp`);
    const query = PRODUCE_IMAGE_QUERIES[item.slug];

    if (!query) {
      failures.push({ slug: item.slug, reason: "sin búsqueda definida" });
      continue;
    }

    if (!force && existsSync(file)) {
      skipped++;
      continue;
    }

    try {
      const chosen = await resolve1(item.slug, query);

      if (!chosen) {
        failures.push({ slug: item.slug, reason: `sin resultados para "${query}"` });
        continue;
      }

      writeFileSync(file, await toSquareWebp(chosen.thumbUrl));
      attributions.push({ slug: item.slug, file: `${item.slug}.webp`, ...chosen });
      downloaded++;

      console.log(`  ✓ ${item.slug.padEnd(24)} ${chosen.source.padEnd(9)} ${chosen.title.slice(6, 55)}`);
    } catch (error) {
      failures.push({ slug: item.slug, reason: error instanceof Error ? error.message : String(error) });
      console.log(`  ✗ ${item.slug.padEnd(24)} ${error instanceof Error ? error.message : error}`);
    }
  }

  if (attributions.length > 0) {
    const path = resolve(OUT_DIR, "attribution.json");
    const previous: Attribution[] = existsSync(path)
      ? (JSON.parse(await import("node:fs/promises").then((fs) => fs.readFile(path, "utf8"))) as Attribution[])
      : [];

    // Al correr sin --force solo se bajan las que faltaban: hay que conservar la
    // atribución de las que ya estaban o se pierde el crédito de esas.
    const merged = new Map(previous.map((entry) => [entry.slug, entry]));
    for (const entry of attributions) merged.set(entry.slug, entry);

    writeFileSync(
      path,
      `${JSON.stringify([...merged.values()].sort((a, b) => a.slug.localeCompare(b.slug)), null, 2)}\n`,
      "utf8",
    );
  }

  console.log(`\nBajadas:   ${downloaded}`);
  console.log(`Ya estaban: ${skipped}`);
  console.log(`Fallaron:  ${failures.length}`);
  for (const failure of failures) console.log(`  ${failure.slug.padEnd(24)} ${failure.reason}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
