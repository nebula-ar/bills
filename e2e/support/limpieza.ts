import { Client } from "pg";

import { PREFIJO_E2E } from "./nombres";

/**
 * Borra lo que dejaron los e2e en la base.
 *
 * Solo lo importan el global setup y el teardown. Ningún spec puede llegar acá:
 * un test que necesite borrar algo directo de la base está mal escrito.
 *
 * Va con `pg` crudo y no con Prisma porque el cliente generado usa
 * `import.meta` y Playwright transpila a CommonJS. Igual conviene: el borrado
 * es una sola sentencia y la cascada la hace Postgres, no la aplicación —las
 * FK de `StockMovement`, `StockLevel`, `BranchProductConfiguration`,
 * `ProductChange` y compañía están declaradas `ON DELETE CASCADE` en las
 * migraciones, así que borrar el producto se lleva todo lo suyo.
 *
 * La excepción es `RecipeItem.ingredientId`, que está en `ON DELETE RESTRICT`:
 * un producto usado como insumo de una receta no se puede borrar. Por eso los
 * tests nunca dan de alta insumos; si alguno lo hiciera, el DELETE fallaría y
 * el teardown lo gritaría en vez de dejarlo pasar.
 */

// Los .env los carga playwright.config.ts, que se ejecuta antes que esto en
// todos los procesos.

async function conConexion<T>(trabajo: (cliente: Client) => Promise<T>): Promise<T> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Falta DATABASE_URL: la limpieza de los e2e no puede correr a ciegas.");
  }

  const cliente = new Client({ connectionString });
  await cliente.connect();
  try {
    return await trabajo(cliente);
  } finally {
    await cliente.end();
  }
}

/**
 * Cuánto quedó vivo de los tests, en las tres tablas que tocan.
 *
 * Cuenta todo junto porque el teardown lo usa para una sola pregunta: ¿quedó
 * algo? Separarlo por tabla no cambiaría lo que hay que hacer, que es borrarlo
 * a mano.
 */
export async function contarProductosDePrueba(): Promise<number> {
  return conConexion(async (cliente) => {
    const { rows } = await cliente.query<{ total: string }>(
      `SELECT (
         (SELECT COUNT(*) FROM "Product" WHERE "name" LIKE $1)
       + (SELECT COUNT(*) FROM "Table"   WHERE "name" LIKE $1)
       + (SELECT COUNT(*) FROM "Sector"  WHERE "name" LIKE $1)
       )::text AS total`,
      [`${PREFIJO_E2E}%`],
    );
    return Number(rows[0]?.total ?? 0);
  });
}

/**
 * Borra lo que dejaron los tests. Devuelve cuántos y cuáles.
 *
 * El `LIKE 'E2E-%'` de cada sentencia es lo único que separa esto de vaciar el
 * catálogo y el salón del negocio. No lo saques, no lo parametrices por fuera y
 * no le agregues un modo "borrar todo".
 *
 * El ORDEN importa y no es alfabético:
 *
 * 1. Las comandas de las mesas de prueba. Una mesa con pedido abierto no se
 *    puede borrar, y esa comanda es de la mesa, así que se va con ella.
 * 2. Las mesas. Cuelgan del sector, así que van antes.
 * 3. Los sectores, ya vacíos.
 * 4. Los productos, que no dependen de nada de lo anterior.
 *
 * Al revés, el primer DELETE choca contra una foreign key y la corrida termina
 * dejando basura en el salón real.
 */
export async function limpiarRestos(): Promise<{ borrados: number; nombres: string[] }> {
  return conConexion(async (cliente) => {
    const patron = `${PREFIJO_E2E}%`;
    const nombres: string[] = [];

    await cliente.query(
      'DELETE FROM "Order" WHERE "tableId" IN (SELECT id FROM "Table" WHERE "name" LIKE $1)',
      [patron],
    );

    for (const tabla of ["Table", "Sector", "Product"] as const) {
      const { rows } = await cliente.query<{ name: string }>(
        `DELETE FROM "${tabla}" WHERE "name" LIKE $1 RETURNING "name"`,
        [patron],
      );
      nombres.push(...rows.map((fila) => fila.name));
    }

    return { borrados: nombres.length, nombres };
  });
}
