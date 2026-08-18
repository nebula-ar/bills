import { prisma } from "@/lib/prisma";
import { getBranchProductConfiguration } from "@/modules/catalog/get-branch-catalog-configuration.use-case";
import { findProductImage } from "@/modules/catalog/product-image.use-case";
import { findProductByCode } from "@/modules/catalog/scan-product.use-case";
import { updateGlobalProduct } from "@/modules/catalog/update-product.use-case";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import {
  CODIGO_COMPARTIDO,
  borrarNegociosDePrueba,
  crearInquilinos,
  enTandas,
  type Inquilino,
} from "./inquilinos";

/**
 * Aislamiento entre inquilinos, con 10 negocios a la vez.
 *
 * Qué prueba esto y qué NO:
 *
 * NO prueba el navegador. Lo que se reportó —dos servidores en :3000 y :3001
 * mostrando datos cruzados— es el frasco de cookies compartido: las cookies se
 * aíslan por dominio y NO por puerto (RFC 6265 §8.5), así que entrar en el 3001
 * pisa la sesión del 3000. Son además dos procesos de Node distintos, sin
 * memoria compartida, así que no hay otro canal posible. Un test de UI con 10
 * navegadores chocaría contra el mismo frasco y no probaría nada.
 *
 * SÍ prueba lo único que importa: que ningún caso de uso devuelva o escriba
 * datos de un negocio distinto del que se le pidió. Ese es el invariante real,
 * y es el que se rompe de verdad el día que una query se olvida del filtro.
 *
 * Todo corre CONCURRENTE a propósito. En `src/lib/prisma.ts` hay una cicatriz:
 * usar el Proxy como receiver hacía que adapter-pg reutilizara mal una conexión
 * bajo carga. Un test secuencial nunca habría visto ese bug.
 */

const INQUILINOS = 10;
const PRODUCTOS_POR_INQUILINO = 5;
/** Cuántas consultas pesadas van a la vez. Ver `enTandas`. */
const TANDA = 4;

let inquilinos: Inquilino[] = [];

/** El de al lado, en círculo: cada inquilino tiene un ajeno con quien probar. */
function vecinoDe(indice: number): Inquilino {
  return inquilinos[(indice + 1) % inquilinos.length]!;
}

beforeAll(async () => {
  inquilinos = await crearInquilinos(INQUILINOS, PRODUCTOS_POR_INQUILINO);
  expect(inquilinos).toHaveLength(INQUILINOS);
});

// Además del teardown global. Redundante y así queda: si alguien corre este
// archivo suelto, igual limpia.
afterAll(async () => {
  await borrarNegociosDePrueba();
  await prisma.$disconnect();
});

describe("Aislamiento entre inquilinos", () => {
  test("cada uno ve su catálogo completo y nada más", async () => {
    const catalogos = await enTandas(inquilinos, TANDA, (inquilino) =>
      getBranchProductConfiguration(inquilino.businessId, inquilino.branchId),
    );

    catalogos.forEach((catalogo, indice) => {
      const propio = inquilinos[indice]!;
      const ids = catalogo.products.map((producto) => producto.id).sort();

      // Ni de menos (no ve lo suyo) ni de más (ve lo ajeno). Las dos fallas son
      // graves y la segunda es la fatal.
      expect(ids).toEqual([...propio.productIds].sort());
      expect(catalogo.branches.map((sucursal) => sucursal.id)).toEqual([propio.branchId]);
    });
  });

  test("el mismo código de barras en los 10 negocios devuelve el propio", async () => {
    // Los 10 comparten `CODIGO_COMPARTIDO`. Es el caso clásico de fuga: la
    // búsqueda por código se escribe pensando en "el" producto y se olvida de
    // que el código solo es único DENTRO del negocio.
    const encontrados = await Promise.all(
      inquilinos.map((inquilino) =>
        findProductByCode({ businessId: inquilino.businessId, branchId: inquilino.branchId, code: CODIGO_COMPARTIDO }),
      ),
    );

    encontrados.forEach((producto, indice) => {
      expect(producto).not.toBeNull();
      expect(inquilinos[indice]!.productIds).toContain(producto!.id);
    });

    // Y que no sean todos el mismo: si la query ignorara el negocio devolvería
    // 10 veces la misma fila y el assert de arriba pasaría igual para uno solo.
    const distintos = new Set(encontrados.map((producto) => producto!.id));
    expect(distintos.size).toBe(INQUILINOS);
  });

  test("editar un producto ajeno es imposible y no lo toca", async () => {
    const antes = await prisma.product.findMany({
      where: { id: { in: inquilinos.flatMap((inquilino) => inquilino.productIds) } },
      select: { id: true, name: true, cost: true },
      orderBy: { id: "asc" },
    });

    const intentos = await Promise.all(
      inquilinos.map(async (inquilino, indice) => {
        const ajeno = vecinoDe(indice).productIds[0]!;
        try {
          await updateGlobalProduct({
            businessId: inquilino.businessId,
            productId: ajeno,
            name: "ROBADO",
            cost: 999_999,
          });
          return "no falló";
        } catch (error) {
          return (error as Error).message;
        }
      }),
    );

    // Ninguno pudo. El mensaje exacto no importa; que haya tirado, sí.
    expect(intentos.filter((resultado) => resultado === "no falló")).toEqual([]);

    // Y la prueba que de verdad cuenta: la base quedó igual. Un caso de uso
    // podría tirar DESPUÉS de haber escrito.
    const despues = await prisma.product.findMany({
      where: { id: { in: inquilinos.flatMap((inquilino) => inquilino.productIds) } },
      select: { id: true, name: true, cost: true },
      orderBy: { id: "asc" },
    });

    expect(despues).toEqual(antes);
  });

  test("el branchId de otro negocio no abre la puerta", async () => {
    // Esto es exactamente lo que se puede escribir a mano en la URL:
    // /catalog?branchId=<sucursal de otro cliente>.
    const catalogos = await enTandas(inquilinos, TANDA, (inquilino, indice) =>
      getBranchProductConfiguration(inquilino.businessId, vecinoDe(indice).branchId),
    );

    catalogos.forEach((catalogo, indice) => {
      const ajeno = vecinoDe(indice);

      // Fail-closed: la sucursal ajena no matchea, así que no hay sucursal
      // elegida. Lo que NUNCA puede pasar es que aparezca la del vecino.
      expect(catalogo.selectedBranch?.id).not.toBe(ajeno.branchId);
      expect(catalogo.branches.map((sucursal) => sucursal.id)).not.toContain(ajeno.branchId);

      const ids = catalogo.products.map((producto) => producto.id);
      for (const ajenoId of ajeno.productIds) {
        expect(ids).not.toContain(ajenoId);
      }
    });
  });

  test("la foto de un producto ajeno no se sirve", async () => {
    // Una foto real, de un solo inquilino. El route handler de /api/products/
    // [id]/image resuelve el businessId de la sesión y pregunta por acá: si
    // esto no filtrara, bastaría con adivinar un id para ver la foto de otro.
    const dueño = inquilinos[0]!;
    const productId = dueño.productIds[0]!;

    await prisma.productImage.create({
      data: {
        productId,
        data: Buffer.from([1, 2, 3, 4]),
        contentType: "image/webp",
        width: 2,
        height: 2,
        byteSize: 4,
      },
    });

    const propia = await findProductImage(productId, dueño.businessId);
    expect(propia).not.toBeNull();

    const ajenas = await Promise.all(
      inquilinos.slice(1).map((inquilino) => findProductImage(productId, inquilino.businessId)),
    );
    expect(ajenas.every((foto) => foto === null)).toBe(true);
  });

  test("10 inquilinos editando a la vez no se pisan", async () => {
    // La regresión de la conexión reusada bajo carga (ver src/lib/prisma.ts).
    // Cada inquilino renombra TODOS sus productos con un valor que lo
    // identifica, todos al mismo tiempo. Si dos requests comparten conexión mal,
    // el costo de uno termina en la fila del otro.
    const RONDAS = 3;

    for (let ronda = 0; ronda < RONDAS; ronda += 1) {
      await Promise.all(
        inquilinos.flatMap((inquilino, indice) =>
          inquilino.productIds.map((productId, n) =>
            updateGlobalProduct({
              businessId: inquilino.businessId,
              productId,
              name: `E2E-P${indice}-${n}-r${ronda}`,
              cost: indice * 1000 + n,
            }),
          ),
        ),
      );
    }

    const filas = await prisma.product.findMany({
      where: { businessId: { in: inquilinos.map((inquilino) => inquilino.businessId) } },
      select: { id: true, businessId: true, name: true, cost: true },
    });

    expect(filas).toHaveLength(INQUILINOS * PRODUCTOS_POR_INQUILINO);

    const porNegocio = new Map(inquilinos.map((inquilino, indice) => [inquilino.businessId, indice]));

    for (const fila of filas) {
      const indice = porNegocio.get(fila.businessId)!;
      const n = inquilinos[indice]!.productIds.indexOf(fila.id);

      // El nombre y el costo llevan el índice del dueño. Si aparece otro, la
      // escritura de un inquilino aterrizó en la fila de otro.
      expect(fila.name).toBe(`E2E-P${indice}-${n}-r${RONDAS - 1}`);
      expect(fila.cost).toBe(indice * 1000 + n);
    }
  });
});
