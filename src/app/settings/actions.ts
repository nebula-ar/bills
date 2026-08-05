"use server";

import { requireBusinessContext } from "@/lib/business-context";
import { isAppModule } from "@/lib/app-modules";
import { logError } from "@/lib/logger";
import { isVertical } from "@/lib/vertical";
import { changeVertical, setModuleEnabled } from "@/modules/business/business-modules.use-case";

export type SettingsActionResult = { ok: boolean; message: string };

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function toggleModuleAction(formData: FormData): Promise<SettingsActionResult> {
  const { session } = await requireBusinessContext();

  const requested = text(formData, "module");

  if (!isAppModule(requested)) {
    return { ok: false, message: "Ese módulo no existe." };
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
    return { ok: false, message: "No pudimos cambiar el módulo. Intentá de nuevo." };
  }

  return { ok: true, message: "Listo." };
}

export async function changeVerticalAction(formData: FormData): Promise<SettingsActionResult> {
  const { session } = await requireBusinessContext();

  const vertical = text(formData, "vertical");

  if (!isVertical(vertical)) {
    return { ok: false, message: "Ese rubro no existe." };
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
    return { ok: false, message: "No pudimos cambiar el rubro. Intentá de nuevo." };
  }

  return { ok: true, message: "Rubro actualizado." };
}
