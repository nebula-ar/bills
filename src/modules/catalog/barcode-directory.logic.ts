// Reglas puras del "buscador de productos por código".
//
// Un código de barras EAN es el mismo en todo el mundo: el alfajor que se escanea
// acá tiene el mismo número que en la base pública de Open Food Facts. Eso nos
// permite completar nombre y foto sin que nadie tipee ni fotografíe nada.
//
// Acá va solo lo que se puede probar sin red: qué códigos vale la pena consultar,
// cómo se arma el nombre y qué URLs de imagen aceptamos descargar.

// Solo EAN/UPC. Un código interno de la verdulería ("444") no está en ninguna
// base mundial: consultarlo es perder un segundo con el cliente enfrente.
const EAN = /^(\d{8}|\d{12,14})$/;

export function isLookupableBarcode(code: string): boolean {
  return EAN.test(code.trim());
}

// Dominios de los que aceptamos bajar una foto. La URL viene de una respuesta
// ajena, así que se trata como entrada hostil: sin esto, un dato manipulado
// podría hacernos pedir cualquier dirección desde el servidor.
const IMAGE_HOSTS = ["openfoodfacts.org", "openproductsfacts.org", "openbeautyfacts.org", "openfoodfacts.net"];

export function isAllowedImageUrl(url: string): boolean {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;

  const host = parsed.hostname.toLowerCase();
  return IMAGE_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

// Largo máximo del nombre sugerido: entra en una línea del mostrador.
const MAX_NAME = 70;

export type DirectoryFields = {
  productName?: string | null;
  brands?: string | null;
  quantity?: string | null;
};

// El nombre útil junta tres campos que la base guarda separados: marca, producto
// y contenido. "Coca Cola 1,5 L" se busca mejor que "Coca-Cola" a secas, porque
// en la góndola conviven la de 500 y la de dos litros y medio.
export function buildDirectoryName(fields: DirectoryFields): string | null {
  const name = clean(fields.productName);

  if (!name) return null;

  // La base trae las marcas separadas por coma; nos quedamos con la primera.
  const brand = clean(fields.brands)?.split(",")[0]?.trim() ?? null;
  const quantity = clean(fields.quantity);

  const parts = [name];

  if (brand && !contains(name, brand)) {
    parts.unshift(brand);
  }

  if (quantity && !contains(name, quantity)) {
    parts.push(quantity);
  }

  return parts.join(" ").slice(0, MAX_NAME).trim();
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  return trimmed ? trimmed : null;
}

// Comparación tolerante: "coca-cola" y "Coca Cola" son la misma marca, y no
// queremos "Coca Cola Coca-Cola 1,5 L".
function contains(haystack: string, needle: string) {
  return plain(haystack).includes(plain(needle));
}

function plain(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}
