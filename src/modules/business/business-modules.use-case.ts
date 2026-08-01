import { AppModule, Vertical } from "@/generated/prisma/client";
import { MODULE_REQUIRES } from "@/lib/app-modules";
import { logEvent } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { verticalPreset } from "@/lib/vertical";

// Prender y apagar módulos es lo que hace que el mismo sistema le sirva a una
// barbería y a una ferretería. Un módulo apagado desaparece de la navegación y
// sus pantallas dejan de ser accesibles (ver requireModule).

export async function getEnabledModules(businessId: string): Promise<AppModule[]> {
  const rows = await prisma.businessModuleAccess.findMany({
    where: { businessId },
    select: { module: true },
  });

  return rows.map((row) => row.module);
}

export async function setModuleEnabled(input: {
  businessId: string;
  module: AppModule;
  enabled: boolean;
  userId?: string | null;
}) {
  // Hay módulos que viven dentro de otro (Proveedores vive dentro de Gastos).
  // Prender el de adentro prende también al que lo aloja, y apagar al que aloja
  // se lleva al de adentro: si no, queda un módulo activo sin ninguna pantalla
  // desde donde entrar.
  const modules = new Set<AppModule>([input.module]);
  const host = MODULE_REQUIRES[input.module];

  if (input.enabled && host) {
    modules.add(host);
  }

  if (!input.enabled) {
    for (const [guest, needs] of Object.entries(MODULE_REQUIRES) as [AppModule, AppModule][]) {
      if (needs === input.module) {
        modules.add(guest);
      }
    }
  }

  if (input.enabled) {
    for (const module of modules) {
      // Idempotente: prender dos veces el mismo módulo no rompe nada.
      await prisma.businessModuleAccess.upsert({
        where: { businessId_module: { businessId: input.businessId, module } },
        create: { businessId: input.businessId, module },
        update: {},
      });
    }
  } else {
    // Apagar solo esconde: los datos del módulo quedan intactos por si lo
    // vuelven a prender (nadie quiere perder su stock por tocar un switch).
    await prisma.businessModuleAccess.deleteMany({
      where: { businessId: input.businessId, module: { in: Array.from(modules) } },
    });
  }

  await logEvent("business.module", `Módulo ${input.module} ${input.enabled ? "activado" : "desactivado"}`, {
    businessId: input.businessId,
    userId: input.userId ?? undefined,
    context: { module: input.module, enabled: input.enabled },
  });
}

// Cambiar de rubro reescribe el vocabulario de la app y sugiere los módulos del
// rubro nuevo. No toca los datos: el catálogo y las ventas siguen igual.
export async function changeVertical(input: {
  businessId: string;
  vertical: Vertical;
  applyPresetModules: boolean;
  userId?: string | null;
}) {
  await prisma.business.update({
    where: { id: input.businessId },
    data: { vertical: input.vertical, updatedById: input.userId },
  });

  if (input.applyPresetModules) {
    const preset = verticalPreset(input.vertical);

    // Se agregan los del rubro nuevo sin apagar los que ya venía usando: si
    // alguien prendió Clientes a mano, cambiar de rubro no se lo saca.
    for (const presetModule of preset.modules) {
      await prisma.businessModuleAccess.upsert({
        where: { businessId_module: { businessId: input.businessId, module: presetModule } },
        create: { businessId: input.businessId, module: presetModule },
        update: {},
      });
    }
  }

  await logEvent("business.vertical", `Rubro cambiado a ${input.vertical}`, {
    businessId: input.businessId,
    userId: input.userId ?? undefined,
    context: { vertical: input.vertical, applyPresetModules: input.applyPresetModules },
  });
}
