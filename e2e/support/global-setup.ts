import { limpiarRestos } from "./limpieza";
import { PREFIJO_E2E } from "./nombres";

/**
 * Barrido de entrada.
 *
 * Existe porque la limpieza del final no corre cuando la corrida se muere: un
 * Ctrl+C, un timeout del server, un corte de luz. Sin este barrido, cada
 * accidente deja productos `E2E-` para siempre en el catálogo real, y un mes
 * después el dueño abre Productos y tiene treinta filas de basura que nadie
 * sabe de dónde salieron.
 *
 * Se anuncia lo que borró en vez de hacerlo callado: si este número no baja a
 * cero nunca, es que algo se está cayendo siempre y hay que mirarlo.
 */
export default async function globalSetup() {
  const { borrados, nombres } = await limpiarRestos();

  if (borrados > 0) {
    console.log(`[e2e] Barridos ${borrados} productos "${PREFIJO_E2E}" que dejó una corrida anterior:`);
    for (const nombre of nombres) console.log(`      - ${nombre}`);
  }
}
