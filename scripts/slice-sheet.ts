// Corta una plancha de imágenes generada por IA en las fotos del catálogo.
//
//   npx tsx scripts/slice-sheet.ts <plancha.png> <slug1,slug2,...> [--cols 3] [--rows 3] [--dry]
//
// Ejemplo:
//   npx tsx scripts/slice-sheet.ts sheets/1.png \
//     tomate,frutilla,morron-rojo,acelga,radicheta,achicoria,anco,papines-andinos,huevos-por-docena
//
// Con --dry deja solo una previsualización en el scratchpad y NO toca
// `public/catalog/produce`. Conviene mirarla antes de dar por buena una plancha.
//
// POR QUÉ NO CORTA EN TERCIOS EXACTOS
// El modelo dibuja "algo con pinta de grilla", no una grilla: los recuadros
// quedan de distinto tamaño y corridos. Cortar en fracciones exactas le come
// hojas a los que se pasan de su celda. Acá se buscan los PASILLOS BLANCOS que
// separan las filas y columnas, y se corta por ahí. Si la plancha no tiene
// pasillos claros, recién ahí cae al corte parejo.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const SIDE = 512;
// Un píxel se considera fondo si sus tres canales están por encima de esto. Las
// planchas vienen con blanco "casi puro" y sombras suaves; 244 deja pasar la
// sombra sin comerse el borde del producto.
const WHITE = 244;
// Un pasillo tiene que medir al menos esto (en % del lado) para contar como
// separación entre celdas. Sin este mínimo, un reflejo blanco adentro de un
// zapallo partiría la celda en dos.
const MIN_GAP_RATIO = 0.02;

type Band = { start: number; end: number };
type Box = { left: number; top: number; width: number; height: number };

// Qué proporción del cuadrado final ocupa el producto. El resto es margen
// blanco. Fijo para todos: es lo que hace que el catálogo parezca una sola
// producción y no 122 fotos de tamaños distintos.
const CONTENT_RATIO = 0.86;

// La mancha de contenido más grande dentro de una celda.
//
// Hace falta porque el modelo no respeta los límites de la grilla: la acelga se
// mete en la celda del anco, y al cortar en la celda del anco aparecen hojas
// verdes colgando. Quedándonos con la mancha más grande y tirando el resto, el
// pedazo del vecino se va solo.
function largestBlob(
  isContent: (x: number, y: number) => boolean,
  cell: Box,
): Box | null {
  const { left, top, width, height } = cell;
  const seen = new Uint8Array(width * height);
  let best: Box | null = null;
  let bestArea = 0;

  for (let startY = 0; startY < height; startY++) {
    for (let startX = 0; startX < width; startX++) {
      const startIndex = startY * width + startX;

      if (seen[startIndex] || !isContent(left + startX, top + startY)) continue;

      // Relleno por inundación iterativo: recursivo se queda sin pila con una
      // hoja de acelga que ocupa media celda.
      const stack = [startIndex];
      seen[startIndex] = 1;

      let area = 0;
      let minX = startX;
      let maxX = startX;
      let minY = startY;
      let maxY = startY;

      while (stack.length > 0) {
        const index = stack.pop()!;
        const x = index % width;
        const y = (index - x) / width;

        area++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;

        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = x + dx;
          const ny = y + dy;

          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;

          const next = ny * width + nx;

          if (seen[next] || !isContent(left + nx, top + ny)) continue;

          seen[next] = 1;
          stack.push(next);
        }
      }

      if (area > bestArea) {
        bestArea = area;
        best = { left: left + minX, top: top + minY, width: maxX - minX + 1, height: maxY - minY + 1 };
      }
    }
  }

  return best;
}

function parseFlag(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = Number(process.argv[index + 1]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

// Dado el perfil de "cuánto contenido hay" por fila (o columna), devuelve los
// tramos ocupados, ignorando los pasillos de fondo.
function bandsFrom(profile: number[], minGap: number): Band[] {
  const bands: Band[] = [];
  let start: number | null = null;
  let gap = 0;

  profile.forEach((value, index) => {
    if (value > 0) {
      if (start === null) start = index - gap > 0 ? index : index;
      gap = 0;
      return;
    }

    gap++;

    // Se cierra el tramo recién cuando el pasillo es lo bastante ancho: así una
    // mancha blanca adentro del producto no lo parte al medio.
    if (start !== null && gap >= minGap) {
      bands.push({ start, end: index - gap });
      start = null;
    }
  });

  if (start !== null) bands.push({ start, end: profile.length - 1 });

  return bands;
}

// Reparte en tramos iguales. Es el plan B cuando la plancha no tiene pasillos.
function evenBands(total: number, count: number): Band[] {
  const size = Math.floor(total / count);
  return Array.from({ length: count }, (_, i) => ({
    start: i * size,
    end: i === count - 1 ? total - 1 : (i + 1) * size - 1,
  }));
}

async function main() {
  const [sheetArg, slugArg] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));

  if (!sheetArg || !slugArg) {
    console.error("Uso: npx tsx scripts/slice-sheet.ts <plancha> <slug1,slug2,...> [--cols 3] [--rows 3] [--dry]");
    process.exit(1);
  }

  const slugs = slugArg.split(",").map((slug) => slug.trim()).filter(Boolean);
  const cols = parseFlag("cols", 3);
  const rows = parseFlag("rows", Math.ceil(slugs.length / cols));
  const dry = process.argv.includes("--dry");

  if (slugs.length !== cols * rows) {
    console.error(`Vinieron ${slugs.length} slugs pero la grilla es ${cols}x${rows} = ${cols * rows} celdas.`);
    process.exit(1);
  }

  const { default: sharp } = await import("sharp");
  const sheetPath = resolve(sheetArg);

  if (!existsSync(sheetPath)) {
    console.error(`No encuentro la plancha en ${sheetPath}`);
    process.exit(1);
  }

  // Guardarraíl: si esta plancha es idéntica a otra ya guardada, casi seguro se
  // copió mal el archivo de origen (pasó: se copió dos veces la misma descarga y
  // salieron 8 imágenes con el contenido de la plancha anterior, cada una con el
  // nombre equivocado). Sin este aviso solo lo delata que dos productos pesen lo
  // mismo, y eso hay que estar mirándolo.
  const { createHash } = await import("node:crypto");
  const { readdirSync, readFileSync } = await import("node:fs");
  const hashOf = (path: string) => createHash("sha1").update(readFileSync(path)).digest("hex");
  const sheetHash = hashOf(sheetPath);
  const sheetDir = resolve(sheetPath, "..");

  for (const other of readdirSync(sheetDir)) {
    const otherPath = resolve(sheetDir, other);

    if (otherPath === sheetPath || !/\.(png|jpe?g|webp)$/i.test(other)) continue;

    if (hashOf(otherPath) === sheetHash) {
      console.error(`\n${basename(sheetPath)} es idéntica a ${other}. ¿Copiaste el archivo correcto?`);
      process.exit(1);
    }
  }

  const image = sharp(sheetPath).removeAlpha();
  const { width, height } = await image.metadata();

  if (!width || !height) {
    console.error("No pude leer las dimensiones de la plancha.");
    process.exit(1);
  }

  console.log(`Plancha: ${basename(sheetPath)}  ${width}x${height}  →  grilla ${cols}x${rows}`);

  // Mapa de contenido: 1 donde hay producto, 0 donde hay fondo.
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  const isContent = (x: number, y: number) => {
    const offset = (y * width + x) * channels;
    return !(data[offset] > WHITE && data[offset + 1] > WHITE && data[offset + 2] > WHITE);
  };

  const colProfile = new Array<number>(width).fill(0);
  const rowProfile = new Array<number>(height).fill(0);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * channels;
      const isBackground = data[offset] > WHITE && data[offset + 1] > WHITE && data[offset + 2] > WHITE;

      if (!isBackground) {
        colProfile[x]++;
        rowProfile[y]++;
      }
    }
  }

  let rowBands = bandsFrom(rowProfile, Math.round(height * MIN_GAP_RATIO));

  if (rowBands.length !== rows) {
    console.log(`  ! detecté ${rowBands.length} filas y esperaba ${rows}: corto parejo`);
    rowBands = evenBands(height, rows);
  }

  // Las columnas se buscan DENTRO de cada fila, no sobre la plancha entera.
  // Proyectar todo junto no sirve: si un producto de la fila de abajo es más
  // ancho que su celda, tapa el pasillo que la fila de arriba sí tiene, y la
  // plancha entera se detecta como una sola columna.
  const colBandsByRow = rowBands.map((band, index) => {
    const profile = new Array<number>(width).fill(0);

    for (let y = band.start; y <= band.end; y++) {
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * channels;
        const isBackground = data[offset] > WHITE && data[offset + 1] > WHITE && data[offset + 2] > WHITE;
        if (!isBackground) profile[x]++;
      }
    }

    const bands = bandsFrom(profile, Math.round(width * MIN_GAP_RATIO));

    if (bands.length !== cols) {
      console.log(`  ! fila ${index + 1}: detecté ${bands.length} columnas y esperaba ${cols}, corto parejo`);
      return evenBands(width, cols);
    }

    return bands;
  });

  const outDir = dry
    ? resolve(import.meta.dirname, "../.sheet-preview")
    : resolve(import.meta.dirname, "../public/catalog/produce");
  mkdirSync(outDir, { recursive: true });

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const slug = slugs[row * cols + col];
      const band = { x: colBandsByRow[row][col], y: rowBands[row] };

      // Se recorta contra el tamaño real de la imagen: una banda que se pase
      // aunque sea un píxel hace fallar el extract entero.
      const cellLeft = Math.max(0, Math.min(band.x.start, width - 1));
      const cellTop = Math.max(0, Math.min(band.y.start, height - 1));
      const cell: Box = {
        left: cellLeft,
        top: cellTop,
        width: Math.max(1, Math.min(band.x.end - band.x.start + 1, width - cellLeft)),
        height: Math.max(1, Math.min(band.y.end - band.y.start + 1, height - cellTop)),
      };

      const blob = largestBlob(isContent, cell);

      if (!blob) {
        console.log(`  ✗ ${slug.padEnd(22)} la celda salió vacía`);
        continue;
      }

      // El producto se escala a una proporción FIJA del cuadrado y el resto es
      // margen. Sin esto cada foto queda de un tamaño distinto según cuánto
      // blanco le tocó, y la grilla del POS se ve despareja.
      const inner = Math.round(SIDE * CONTENT_RATIO);
      const pad = Math.round((SIDE - inner) / 2);

      const buffer = await sharp(sheetPath)
        .removeAlpha()
        .extract(blob)
        // `contain` no recorta: mete el producto entero en el cuadrado. Distinto
        // de las fotos que sube el dueño, que sí se recortan al centro — acá ya
        // viene aislado sobre blanco y recortar le comería las puntas.
        .resize(inner, inner, { fit: "contain", background: "#ffffff" })
        .extend({ top: pad, bottom: SIDE - inner - pad, left: pad, right: SIDE - inner - pad, background: "#ffffff" })
        .webp({ quality: 80 })
        .toBuffer();

      writeFileSync(resolve(outDir, `${slug}.webp`), buffer);
      console.log(`  ✓ ${slug.padEnd(22)} ${blob.width}x${blob.height} en (${blob.left},${blob.top})`);
    }
  }

  console.log(`\n${dry ? "PREVISUALIZACIÓN (no se tocó public/)" : "Escrito"} en ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
