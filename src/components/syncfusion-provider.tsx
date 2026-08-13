"use client";

// Provider de Syncfusion EJ2 para el dashboard. Importa, una sola vez, la
// configuración global (license + locale es, ver syncfusion-setup) y los
// estilos del tema "tailwind" (el que mejor convive con el resto de la app).
//
// Los estilos viven en node_modules/@syncfusion/ej2-*/styles/*.css. Solo se
// bundlean en las páginas que usan este provider (el dashboard).
import "@/lib/syncfusion-setup";
import "@syncfusion/ej2-base/styles/tailwind.css";
import "@syncfusion/ej2-buttons/styles/tailwind.css";
import "@syncfusion/ej2-inputs/styles/tailwind.css";
import "@syncfusion/ej2-popups/styles/tailwind.css";
import "@syncfusion/ej2-calendars/styles/tailwind.css";
import "@syncfusion/ej2-navigations/styles/tailwind.css";
import "@syncfusion/ej2-grids/styles/tailwind.css";
import "./syncfusion-overrides.css";

import { useEffect, type ReactNode } from "react";

// El aria-label interno del <svg> de los charts ("Interactive chart") está
// hardcodeado en inglés dentro del vendor (ej2-svg-base) y no sale del locale.
// Lo reescribimos al español apenas aparece en el DOM (el provider vive solo en
// el dashboard, así que no toca nada más).
const INTERACTIVE_CHART_LABEL = "Interactive chart";
const SPANISH_CHART_LABEL = "Gráfico interactivo";

function patchChartAriaLabels() {
  document
    .querySelectorAll<SVGElement>(`svg[aria-label="${INTERACTIVE_CHART_LABEL}"]`)
    .forEach((svg) => svg.setAttribute("aria-label", SPANISH_CHART_LABEL));
}

export function SyncfusionProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    patchChartAriaLabels();
    const observer = new MutationObserver(patchChartAriaLabels);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return <>{children}</>;
}
