import { contarProductosDePrueba, limpiarRestos } from "./limpieza";
import { PREFIJO_E2E } from "./nombres";

/**
 * Barrido de salida.
 *
 * Corre pasen o fallen los tests: un test que se cae a la mitad del alta es
 * justo el que deja el producto creado, así que atarlo al éxito sería atarlo al
 * caso que menos ensucia.
 *
 * Verifica DESPUÉS de borrar. Si algo quedó vivo no se traga el problema: lo
 * grita con los nombres, porque son filas que están en el catálogo real del
 * negocio y alguien las tiene que sacar a mano.
 */
export default async function globalTeardown() {
  const { borrados } = await limpiarRestos();
  const quedaron = await contarProductosDePrueba();

  console.log(`[e2e] Limpieza: ${borrados} productos de prueba borrados.`);

  if (quedaron > 0) {
    throw new Error(
      `[e2e] LIMPIEZA INCOMPLETA: quedaron ${quedaron} productos con prefijo "${PREFIJO_E2E}" en la base real. ` +
        `Buscalos en Productos y borralos a mano.`,
    );
  }
}
