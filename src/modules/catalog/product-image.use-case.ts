import { prisma } from "@/lib/prisma";
import { logEvent } from "@/lib/logger";

import { ProductError, ProductErrorCode } from "./product.errors";

// Foto del producto. La regla es que lo que se guarda NO es lo que subieron:
// todo se normaliza a una miniatura chica en WebP. Motivos:
//   - En el mostrador la foto se ve a 150px; guardar 4 MB de una cámara de
//     celular sería tirar plata y hacer lento el POS, que es la pantalla que
//     más se usa.
//   - Al normalizar, da igual si suben PNG, HEIC o JPEG gigante.
//   - Con un tamaño acotado, guardarlas en la base es razonable y el sistema no
//     depende de ningún servicio externo (ver nota de almacenamiento abajo).

// Lado máximo de la miniatura guardada.
const MAX_SIDE = 512;
// Tope de lo que aceptamos recibir. El cliente ya achica antes de subir, así que
// esto es una red de seguridad contra un archivo enorme.
export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/heic", "image/heif"];

export type SaveProductImageInput = {
  businessId: string;
  productId: string;
  file: File;
  userId?: string | null;
};

export async function saveProductImage(input: SaveProductImageInput) {
  const product = await prisma.product.findFirst({
    where: { id: input.productId, businessId: input.businessId, deleted: false },
    select: { id: true, name: true },
  });

  if (!product) {
    throw new ProductError(ProductErrorCode.PRODUCT_NOT_FOUND);
  }

  if (input.file.size === 0) {
    throw new ProductError(ProductErrorCode.INVALID_IMAGE);
  }

  if (input.file.size > MAX_UPLOAD_BYTES) {
    throw new ProductError(ProductErrorCode.IMAGE_TOO_LARGE);
  }

  // El tipo que declara el navegador es una pista, no una garantía: lo que
  // realmente valida el archivo es que sharp pueda decodificarlo.
  if (input.file.type && !ALLOWED_TYPES.includes(input.file.type)) {
    throw new ProductError(ProductErrorCode.INVALID_IMAGE_TYPE);
  }

  const original = Buffer.from(await input.file.arrayBuffer());
  const { data, contentType, width, height } = await normalize(original);

  await prisma.$transaction(async (tx) => {
    await tx.productImage.upsert({
      where: { productId: product.id },
      create: { productId: product.id, data, contentType, width, height, byteSize: data.byteLength },
      update: { data, contentType, width, height, byteSize: data.byteLength },
    });

    // El listado se entera de que hay foto sin tocar los bytes.
    await tx.product.update({ where: { id: product.id }, data: { imageUpdatedAt: new Date() } });
  });

  await logEvent("product.image.save", `Foto cargada en ${product.name}`, {
    businessId: input.businessId,
    userId: input.userId ?? undefined,
    context: { productId: product.id, bytes: data.byteLength, width, height },
  });

  return { width, height, byteSize: data.byteLength };
}

export async function removeProductImage(input: { businessId: string; productId: string; userId?: string | null }) {
  const product = await prisma.product.findFirst({
    where: { id: input.productId, businessId: input.businessId, deleted: false },
    select: { id: true, name: true },
  });

  if (!product) {
    throw new ProductError(ProductErrorCode.PRODUCT_NOT_FOUND);
  }

  await prisma.$transaction(async (tx) => {
    await tx.productImage.deleteMany({ where: { productId: product.id } });
    await tx.product.update({ where: { id: product.id }, data: { imageUpdatedAt: null } });
  });

  await logEvent("product.image.remove", `Foto quitada de ${product.name}`, {
    businessId: input.businessId,
    userId: input.userId ?? undefined,
    context: { productId: product.id },
  });
}

// Los bytes para servir la foto. Se chequea el negocio acá: una foto de otro
// negocio no se sirve ni sabiendo el id.
export function findProductImage(productId: string, businessId: string) {
  return prisma.productImage.findFirst({
    where: { productId, product: { businessId, deleted: false } },
    select: { data: true, contentType: true, updatedAt: true },
  });
}

// Recorta al cuadrado y reencoda en WebP. `sharp` se importa dinámicamente para
// que no entre en el bundle de las pantallas que no suben fotos.
async function normalize(original: Buffer) {
  const { default: sharp } = await import("sharp");

  try {
    const image = sharp(original, { failOn: "error" }).rotate();
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new ProductError(ProductErrorCode.INVALID_IMAGE);
    }

    const data = await image
      // `cover` recorta al centro: en una grilla de productos todas las fotos
      // tienen que ocupar el mismo cuadrado o la pantalla queda despareja.
      .resize(MAX_SIDE, MAX_SIDE, { fit: "cover", position: "centre", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    const result = await sharp(data).metadata();

    return {
      // Prisma tipa Bytes como Uint8Array; copiamos el Buffer para que el tipo
      // del buffer subyacente coincida.
      data: new Uint8Array(data),
      contentType: "image/webp",
      width: result.width ?? MAX_SIDE,
      height: result.height ?? MAX_SIDE,
    };
  } catch (error) {
    if (error instanceof ProductError) {
      throw error;
    }

    // sharp no pudo decodificarlo: no era una imagen, por más que dijera serlo.
    throw new ProductError(ProductErrorCode.INVALID_IMAGE);
  }
}
