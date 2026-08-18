import { prisma } from "@/lib/prisma";

import { borrarNegociosDePrueba, contarNegociosDePrueba } from "./inquilinos";

/**
 * Barrido garantizado, antes y después.
 *
 * ANTES: si una corrida anterior se murió a la mitad —Ctrl+C, se cayó la red,
 * se fue la luz— dejó negocios `E2E-` vivos. Barrer al arrancar es lo que evita
 * que la basura se acumule corrida tras corrida en la base del cliente.
 *
 * DESPUÉS: el teardown de vitest corre aunque los tests fallen. Y si después de
 * borrar todavía queda algo, esto TIRA. Un teardown que se traga el error deja
 * datos de prueba en producción y encima dice que salió todo bien.
 */
export default async function setup() {
  const previos = await borrarNegociosDePrueba();
  if (previos > 0) {
    console.log(`[tenancy] barridos ${previos} negocios de una corrida anterior.`);
  }

  return async () => {
    let quedan = 0;

    try {
      const borrados = await borrarNegociosDePrueba();
      quedan = await contarNegociosDePrueba();
      console.log(`[tenancy] barridos ${borrados} negocios de prueba. Quedan ${quedan}.`);
    } finally {
      // Sin esto el pool queda abierto y vitest no puede cerrar el proceso.
      await prisma.$disconnect();
    }

    if (quedan > 0) {
      throw new Error(
        `Quedaron ${quedan} negocios de prueba sin borrar en la base. Borralos a mano antes de seguir.`,
      );
    }
  };
}
