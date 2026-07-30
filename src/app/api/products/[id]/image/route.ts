import { getCurrentSession } from "@/lib/auth";
import { getStaffSession } from "@/lib/terminal-session";
import { findProductImage } from "@/modules/catalog/product-image.use-case";
import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";

// Sirve la foto de un producto. Va por route handler y no por `<img src=data:>`
// para que el navegador la cachee una sola vez y no viaje embebida en cada
// render del POS (que lista decenas de productos).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const businessId = await resolveBusinessId();

  if (!businessId) {
    return new Response("No autorizado", { status: 401 });
  }

  const image = await findProductImage(id, businessId);

  if (!image) {
    return new Response("No encontrada", { status: 404 });
  }

  // La URL lleva `?v=<timestamp>`, así que un mismo `v` siempre devuelve los
  // mismos bytes: se puede cachear fuerte y al cambiar la foto cambia la URL.
  const etag = `"${id}-${image.updatedAt.getTime()}"`;

  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.contentType,
      "Content-Length": String(image.data.byteLength),
      ETag: etag,
      // `private`: es de un negocio, no de un CDN compartido.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

// La foto la miran tanto el admin como el empleado desde su terminal (que se
// identifica con PIN, no con NextAuth), así que aceptamos las dos sesiones.
async function resolveBusinessId(): Promise<string | null> {
  const session = await getCurrentSession();

  if (session?.user?.businessId) {
    return session.user.businessId;
  }

  const staff = await getStaffSession();

  if (!staff) {
    return null;
  }

  const branch = await prisma.branch.findUnique({
    where: { id: staff.branchId },
    select: { businessId: true },
  });

  return branch?.businessId ?? null;
}
