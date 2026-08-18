import { Unit } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { PREFIJO_E2E, nombreDePrueba } from "../support/nombres";

/**
 * Fábrica y barrido de negocios de prueba.
 *
 * Estos tests escriben en la MISMA base que usa el negocio de verdad. Todo lo
 * que se crea acá cuelga de un `Business` con prefijo `E2E-`, y las 25
 * relaciones que apuntan a `Business` están declaradas `onDelete: Cascade` en
 * el esquema —verificado, sin excepciones—, así que borrar el negocio se lleva
 * sucursales, productos, precios, fotos, movimientos y todo lo demás. No hay
 * que acordarse del orden ni de ninguna tabla: es una sola sentencia.
 *
 * El seed va por Prisma directo y no por los casos de uso, y esto sí es
 * deliberado: lo que se está probando ES el aislamiento de los casos de uso. Si
 * los datos entraran por ellos, un caso de uso que filtra podría sembrar mal y
 * el test verificaría su propio error. El seed tiene que ser tonto.
 */

/**
 * Concurrencia acotada.
 *
 * `getBranchProductConfiguration` es una consulta con varios joins, y diez a la
 * vez tumban el pooler de Supabase en session mode (puerto 5432): devuelve
 * "Server has closed the connection" antes de contestar. No es un problema de
 * aislamiento —por eso no se afloja el test, se acota el fan-out—, pero SÍ es
 * un dato de capacidad que conviene mirar aparte.
 *
 * Cuatro a la vez sigue siendo concurrencia real: alcanza para que dos
 * inquilinos compartan conexión, que es lo que el test quiere provocar.
 */
export async function enTandas<T, R>(
  items: T[],
  tamaño: number,
  trabajo: (item: T, indice: number) => Promise<R>,
): Promise<R[]> {
  const salida: R[] = [];

  for (let desde = 0; desde < items.length; desde += tamaño) {
    const tanda = items.slice(desde, desde + tamaño);
    salida.push(...(await Promise.all(tanda.map((item, n) => trabajo(item, desde + n)))));
  }

  return salida;
}

export type Inquilino = {
  nombre: string;
  businessId: string;
  branchId: string;
  /** Los productos que le pertenecen, en el orden en que se crearon. */
  productIds: string[];
};

/** El código de barras que TODOS los inquilinos comparten. Ver el test. */
export const CODIGO_COMPARTIDO = "7790000000001";

/**
 * Crea `cantidad` negocios, cada uno con una sucursal y `productos` productos.
 *
 * Los nombres de producto son idénticos entre inquilinos ("Producto 1", "2"…) a
 * propósito: si un caso de uso filtra por nombre en vez de por negocio, con
 * nombres distintos el test pasaría igual.
 */
export async function crearInquilinos(cantidad: number, productos: number): Promise<Inquilino[]> {
  const pedidos = Array.from({ length: cantidad }, (_, i) => i);

  return Promise.all(
    pedidos.map(async (indice) => {
      const nombre = nombreDePrueba(`negocio-${indice}`);

      const business = await prisma.business.create({
        data: {
          name: nombre,
          branches: { create: { name: `${PREFIJO_E2E}sucursal-${indice}` } },
        },
        select: { id: true, branches: { select: { id: true } } },
      });

      const branchId = business.branches[0]!.id;

      const productIds: string[] = [];
      for (let n = 0; n < productos; n += 1) {
        const product = await prisma.product.create({
          data: {
            businessId: business.id,
            name: `${PREFIJO_E2E}Producto ${n}`,
            unit: Unit.UNIT,
            // Solo el PRIMERO de cada negocio lleva el código compartido: los
            // 10 inquilinos tienen un producto con el mismo código de barras.
            // Es legal —hay un índice único (businessId, barcode), así que el
            // código es único por negocio y no global— y es el caso que caza
            // una búsqueda por código que se olvidó de filtrar por inquilino.
            barcode: n === 0 ? CODIGO_COMPARTIDO : `${PREFIJO_E2E}${indice}-${n}`,
            // El costo identifica al dueño: si aparece el de otro, se filtró.
            cost: 1000 + indice,
            branchPrices: { create: { branchId, price: 10_000 + indice } },
          },
          select: { id: true },
        });
        productIds.push(product.id);
      }

      return { nombre, businessId: business.id, branchId, productIds };
    }),
  );
}

/**
 * Barre TODO lo que dejaron estos tests.
 *
 * El `startsWith(PREFIJO_E2E)` es lo único que separa esto de vaciar la cuenta
 * del cliente. No lo saques, no lo parametrices desde afuera y no le agregues
 * un modo "borrar todo". El guard de abajo existe porque un prefijo vacío
 * convertiría este `deleteMany` en un `DELETE FROM "Business"`.
 */
export async function borrarNegociosDePrueba(): Promise<number> {
  if (!PREFIJO_E2E || PREFIJO_E2E.trim().length < 3) {
    throw new Error("PREFIJO_E2E vacío o demasiado corto: el barrido se niega a correr a ciegas.");
  }

  const negocios = await prisma.business.findMany({
    where: { name: { startsWith: PREFIJO_E2E } },
    select: { id: true },
  });
  const ids = negocios.map((negocio) => negocio.id);

  if (ids.length === 0) return 0;

  // Las FK `onDelete: Restrict` van PRIMERO, y este orden no es opcional.
  //
  // Borrar el negocio NO alcanza, aunque sus 25 relaciones directas sean
  // Cascade. El problema son los nietos: `Sale` no cuelga de `Business` sino de
  // `Branch` y de `User`, y esas dos FK son Restrict. Postgres entonces se
  // niega a borrar la sucursal —y con ella al negocio— mientras exista una
  // venta. Lo mismo `Quote` (Branch), `Order` (User) y `Purchase` (Supplier).
  //
  // Esto ya falló una vez y dejó 22 negocios de prueba vivos en la base del
  // cliente. Si mañana un test siembra otra entidad con FK Restrict, el barrido
  // vuelve a fallar: el teardown TIRA en ese caso, a propósito, para que se vea.
  await prisma.sale.deleteMany({ where: { branch: { businessId: { in: ids } } } });
  await prisma.quote.deleteMany({ where: { branch: { businessId: { in: ids } } } });
  await prisma.order.deleteMany({ where: { businessId: { in: ids } } });
  await prisma.purchase.deleteMany({ where: { businessId: { in: ids } } });
  await prisma.recipeItem.deleteMany({ where: { ingredient: { businessId: { in: ids } } } });

  const { count } = await prisma.business.deleteMany({ where: { id: { in: ids } } });

  return count;
}

/** Cuántos negocios de prueba quedaron vivos. El teardown lo usa para gritar. */
export async function contarNegociosDePrueba(): Promise<number> {
  return prisma.business.count({ where: { name: { startsWith: PREFIJO_E2E } } });
}
