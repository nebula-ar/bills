"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AppModule } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { capabilitiesOf } from "@/lib/capabilities";
import { puedeAvanzar, siguienteEstado } from "@/modules/tables/kitchen";
import { avanzarRenglon, findRenglon } from "@/modules/tables/kitchen.repository";

export async function avanzarAction(formData: FormData) {
  const { session } = await requireModule(AppModule.KITCHEN);

  const itemId = typeof formData.get("itemId") === "string" ? String(formData.get("itemId")).trim() : "";
  const branchId = typeof formData.get("branchId") === "string" ? String(formData.get("branchId")).trim() : "";

  const renglon = await findRenglon(session.user.businessId, itemId);

  if (renglon && puedeAvanzar(renglon.kdsStatus, capabilitiesOf(session.user.role))) {
    await avanzarRenglon(itemId, session.user.businessId, siguienteEstado(renglon.kdsStatus));
  }

  revalidatePath("/cocina");
  revalidatePath("/salon");
  redirect(branchId ? `/cocina?branchId=${branchId}` : "/cocina");
}
