"use client";

// Provider de Syncfusion EJ2 para la pantalla Facturación / AFIP. Importa,
// una sola vez, la configuración global (license + locale es, ver
// syncfusion-setup) y los estilos del tema "tailwind": los mismos de Gestión
// más los de Toast y ProgressButton, que esta pantalla usa.
//
// Los estilos viven en node_modules/@syncfusion/ej2-*/styles/*.css. Solo se
// bundlean en las páginas que usan este provider (facturación y su skeleton).
import "@/lib/syncfusion-setup";
import "@syncfusion/ej2-base/styles/tailwind.css";
import "@syncfusion/ej2-buttons/styles/tailwind.css";
import "@syncfusion/ej2-inputs/styles/tailwind.css";
import "@syncfusion/ej2-popups/styles/tailwind.css";
import "@syncfusion/ej2-navigations/styles/tailwind.css";
import "@syncfusion/ej2-grids/styles/tailwind.css";
import "@syncfusion/ej2-dropdowns/styles/tailwind.css";
import "@syncfusion/ej2-notifications/styles/tailwind.css";
import "@syncfusion/ej2-splitbuttons/styles/tailwind.css";
import "./syncfusion-overrides.css";
import "./syncfusion-gestion.css";
import "./syncfusion-facturacion.css";

import type { ReactNode } from "react";

export function SyncfusionFacturacionProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
