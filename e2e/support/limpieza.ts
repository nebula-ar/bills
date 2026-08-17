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

/** Cuántos productos de prueba hay vivos ahora mismo. */
export async function contarProductosDePrueba(): Promise<number> {
  return conConexion(async (cliente) => {
    const { rows } = await cliente.query<{ total: string }>(
      'SELECT COUNT(*)::text AS total FROM "Product" WHERE "name" LIKE $1',
      [`${PREFIJO_E2E}%`],
    );
    return Number(rows[0]?.total ?? 0);
  });
}

/**
 * Borra los productos de prueba. Devuelve cuántos y cuáles.
 *
 * El `WHERE name LIKE 'E2E-%'` es lo único que separa esto de vaciar el
 * catálogo del negocio. No lo saques, no lo parametrices por fuera y no le
 * agregues un modo "borrar todo".
 */
export async function limpiarRestos(): Promise<{ borrados: number; nombres: string[] }> {
  return conConexion(async (cliente) => {
    const { rows } = await cliente.query<{ name: string }>(
      'DELETE FROM "Product" WHERE "name" LIKE $1 RETURNING "name"',
      [`${PREFIJO_E2E}%`],
    );
    return { borrados: rows.length, nombres: rows.map((fila) => fila.name) };
  });
}
