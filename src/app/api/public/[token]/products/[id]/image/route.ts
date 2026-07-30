import { findProductImage } from "@/modules/catalog/product-image.use-case";
import { getPublicBusiness } from "@/modules/marketing/marketing.use-cases";
import type { NextRequest } from "next/server";

// Fotos de producto para la página pública.
//
// Va por una ruta aparte de `/api/products/[id]/image` a propósito: aquella
// exige sesión, y acá no hay ninguna. La autorización es el token del negocio,
// que además acota qué se puede pedir — solo productos de ESE negocio y solo
// mientras la página pública esté prendida. Apagarla corta también las fotos.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; id: string }> },
) {
  const { token, id } = await params;

  const business = await getPublicBusiness(token);

  if (!business) {
    return new Response("No encontrada", { status: 404 });
  }

  const image = await findProductImage(id, business.id);

  if (!image) {
    return new Response("No encontrada", { status: 404 });
  }

  const etag = `"${id}-${image.updatedAt.getTime()}"`;

  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.contentType,
      ETag: etag,
      // La URL lleva ?v=<timestamp>, así que estos bytes no cambian nunca. Es
      // pública, así que puede cachearse en cualquier lado.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
