"use server";

import { requireBusinessContext } from "@/lib/business-context";
import { isAppModule } from "@/lib/app-modules";
import { logError } from "@/lib/logger";
import { isVertical } from "@/lib/vertical";
import { changeVertical, setModuleEnabled } from "@/modules/business/business-modules.use-case";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function toggleModuleAction(formData: FormData) {
  const { session } = await requireBusinessContext();

  const requested = text(formData, "module");

  if (!isAppModule(requested)) {
    back("error", "Ese módulo no existe.");
  }

  try {
    await setModuleEnabled({
      businessId: session.user.businessId,
      module: requested,
      enabled: text(formData, "enabled") === "true",
      userId: session.user.id,
    });
  } catch (error) {
    await logError("business.module", error, { businessId: session.user.businessId, userId: session.user.id });
    back("error", "No pudimos cambiar el módulo. Intentá de nuevo.");
  }

  back("success", "Listo.");
}

export async function changeVerticalAction(formData: FormData) {
  const { session } = await requireBusinessContext();

  const vertical = text(formData, "vertical");

  if (!isVertical(vertical)) {
    back("error", "Ese rubro no existe.");
  }

  try {
    await changeVertical({
      businessId: session.user.businessId,
      vertical,
      applyPresetModules: formData.get("applyPresetModules") !== null,
      userId: session.user.id,
    });
  } catch (error) {
    await logError("business.vertical", error, { businessId: session.user.businessId, userId: session.user.id });
    back("error", "No pudimos cambiar el rubro. Intentá de nuevo.");
  }

  back("success", "Rubro actualizado.");
}

function back(status: "success" | "error", message: string): never {
  // La acción acabó de mutar datos y el redirect vuelve a la MISMA ruta: sin
  // invalidarla, el router del cliente puede servir el árbol que ya tenía y el
  // usuario ve el valor de antes (visto de verdad: un ajuste de stock a 50 que
  // seguía mostrando 111).
  revalidatePath("/settings");

  redirect(`/settings?${new URLSearchParams({ status, message }).toString()}`);
}
