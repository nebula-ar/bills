import { logError } from "@/lib/logger";

import { buildDirectoryName, isAllowedImageUrl, isLookupableBarcode } from "./barcode-directory.logic";

// Buscador de productos por código de barras contra bases públicas.
//
// Por qué existe: al cargar mercadería, la cámara ya está apuntando al código,
// así que la foto que salía era la del código de barras — inútil en el mostrador,
// donde la foto sirve para reconocer el producto de un vistazo. El código en sí
// alcanza para traer el nombre y una foto de verdad.
//
// Las bases son las de Open Food Facts (alimentos, bebidas y kiosco), Open Beauty
// Facts (perfumería) y Open Products Facts (el resto). Son abiertas, gratuitas y
// sin clave. Si no contestan o no conocen el código, no pasa nada: se sigue
// cargando a mano, como siempre.

export type DirectorySuggestion = {
  name: string;
  imageUrl: string | null;
};

// Las tres bases, en el orden en que conviene preguntar para un comercio de acá:
// la mayoría de lo que se escanea en un kiosco o almacén es comida.
const SOURCES = [
  "https://world.openfoodfacts.org",
  "https://world.openbeautyfacts.org",
  "https://world.openproductsfacts.org",
];

const FIELDS = "product_name,product_name_es,brands,quantity,image_front_url,image_url";

// Con el cliente enfrente nadie espera: si en 3 segundos no contestó, se carga a
// mano y listo.
const TIMEOUT_MS = 3000;

// Las bases piden identificarse. Es su única condición de uso.
const USER_AGENT = "Bills/1.0 (gestion para comercios; https://bills.com.ar)";

// Tope de la foto que bajamos. Después sharp la achica a 512px igual.
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

export async function lookupBarcodeInDirectory(code: string): Promise<DirectorySuggestion | null> {
  const clean = code.trim();

  if (!isLookupableBarcode(clean)) {
    return null;
  }

  // Las tres se preguntan a la vez: en serie, un comercio sin internet esperaría
  // tres timeouts encadenados antes de poder cargar el producto a mano.
  const answers = await Promise.all(SOURCES.map((source) => askSource(source, clean)));

  return answers.find(Boolean) ?? null;
}

async function askSource(source: string, code: string): Promise<DirectorySuggestion | null> {
  try {
    const response = await fetch(`${source}/api/v2/product/${code}.json?fields=${FIELDS}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // El catálogo mundial no cambia de un día para el otro, y el mismo código
      // se escanea muchas veces al reponer una caja entera.
      next: { revalidate: 60 * 60 * 24 * 30 },
    });

    // 404 es la respuesta normal para un código que no conocen.
    if (!response.ok) return null;

    const payload = (await response.json()) as {
      status?: number;
      product?: {
        product_name?: string;
        product_name_es?: string;
        brands?: string;
        quantity?: string;
        image_front_url?: string;
        image_url?: string;
      };
    };

    const product = payload.product;

    if (payload.status !== 1 || !product) return null;

    // El nombre en español gana cuando está: es el que el cliente va a buscar.
    const name = buildDirectoryName({
      productName: product.product_name_es || product.product_name,
      brands: product.brands,
      quantity: product.quantity,
    });

    if (!name) return null;

    const imageUrl = product.image_front_url || product.image_url || null;

    return { name, imageUrl: imageUrl && isAllowedImageUrl(imageUrl) ? imageUrl : null };
  } catch {
    // Sin red, con la red lenta o con la base caída, esto no es un error del
    // negocio: es simplemente que no hubo sugerencia.
    return null;
  }
}

// Baja la foto sugerida y la devuelve como File, para que siga el mismo camino
// que una foto sacada con la cámara (validación y miniatura incluidas).
export async function downloadDirectoryImage(url: string): Promise<File | null> {
  if (!isAllowedImageUrl(url)) return null;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS * 2),
      next: { revalidate: 60 * 60 * 24 * 30 },
    });

    if (!response.ok) return null;

    const type = response.headers.get("content-type") ?? "";

    if (!type.startsWith("image/")) return null;

    const bytes = await response.arrayBuffer();

    if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) return null;

    return new File([bytes], "producto.jpg", { type: type.split(";")[0] });
  } catch (error) {
    await logError("product.directory.image", error, { context: { url } });
    return null;
  }
}
