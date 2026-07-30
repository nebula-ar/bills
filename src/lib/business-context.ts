import { AppModule, Vertical } from "@/generated/prisma/client";
import { requireAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { cache } from "react";

import { DEFAULT_LABELS, verticalLabels, type VerticalLabels } from "./vertical";

// Todo lo que una pantalla necesita saber del negocio para decidir qué mostrar:
// el rubro (que define el vocabulario) y los módulos prendidos (que definen
// qué existe). Se resuelve una sola vez por request.

export type BusinessContext = {
  id: string;
  name: string;
  vertical: Vertical;
  labels: VerticalLabels;
  modules: ReadonlySet<AppModule>;
  has: (module: AppModule) => boolean;
};

// Igual que el anterior pero sin redirigir: devuelve null si el negocio no
// existe. Lo usa el layout, que corre en TODAS las rutas —incluida /login—: si
// desde ahí se redirige, una sesión que apunta a un negocio borrado deja la app
// en un bucle de redirecciones y ni siquiera se puede volver a entrar.
export const findBusinessContext = cache(async (businessId: string): Promise<BusinessContext | null> => {
  const business = await prisma.business.findFirst({
    where: { id: businessId, deleted: false },
    select: {
      id: true,
      name: true,
      vertical: true,
      modules: { select: { module: true } },
    },
  });

  if (!business) {
    return null;
  }

  const modules = new Set(business.modules.map((row) => row.module));

  return {
    id: business.id,
    name: business.name,
    vertical: business.vertical,
    labels: verticalLabels(business.vertical),
    modules,
    has: (module: AppModule) => modules.has(module),
  };
});

export const getBusinessContext = cache(async (businessId: string): Promise<BusinessContext> => {
  const business = await findBusinessContext(businessId);

  if (!business) {
    // La sesión apunta a un negocio que ya no existe (típico después de resetear
    // la base con la cookie vieja en el navegador). Se manda al login, que
    // ahora SÍ renderiza: el layout dejó de redirigir por su cuenta.
    redirect("/login");
  }

  return business;
});

// Atajo para las páginas de administración: sesión válida + contexto del negocio.
export async function requireBusinessContext() {
  const session = await requireAdminSession();
  const business = await getBusinessContext(session.user.businessId);

  return { session, business };
}

// Igual que el anterior, pero además exige que el módulo esté prendido. Evita
// que alguien entre por URL a una pantalla que su negocio no tiene activada.
export async function requireModule(module: AppModule) {
  const context = await requireBusinessContext();

  if (!context.business.has(module)) {
    redirect("/");
  }

  return context;
}

// Vocabulario sin sesión (landing, login): el genérico de comercio.
export const publicLabels = DEFAULT_LABELS;
