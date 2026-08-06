import { ProductKind } from "@/generated/prisma/enums";

import { QUANTITY_SCALE } from "@/lib/quantity";

/**
 * Recetas: qué insumo consume cada producto, cuánto se produjo, qué se tiró.
 *
 * Un insumo NO es un modelo aparte: es un Product con `kind: INGREDIENT`. Un
 * ingrediente ES un producto que no vendés —se le compra a un proveedor, tiene
 * stock, tiene costo y se desperdicia—, así que separarlo obligaba a duplicar
 * stock, movimientos, compras y proveedores para expresar una sola diferencia:
 * que no tiene precio de venta.
 *
 * Cantidades en milésimas (120 = 0,12 kg), costos en pesos enteros.
 */

export type RenglonDeReceta = {
  ingredienteId: string;
  /** Cuánto lleva UNA unidad del producto, en milésimas. */
  cantidad: number;
  /** Costo del insumo por unidad entera (por kilo, por litro). */
  costoPorUnidad: number | null;
};

/**
 * ¿Este tipo de producto se ofrece a la venta?
 *
 * La regla vive acá, en una sola función, y no repetida en cada consulta: es
 * el precio de reusar Product para los insumos, y olvidarla en un solo lugar
 * pone la harina en el POS entre las medialunas.
 */
export function seVende(kind: ProductKind): boolean {
  return kind !== ProductKind.INGREDIENT;
}

/**
 * Cuánto cuesta hacer UNA unidad, en pesos enteros.
 *
 * Un insumo sin costo cargado suma cero en vez de ensuciar el total: pasa
 * cuando todavía no se registró ninguna compra de ese insumo, y un NaN acá se
 * propagaría hasta el margen del reporte.
 */
export function costoDeReceta(receta: RenglonDeReceta[]): number {
  const total = receta.reduce((suma, renglon) => {
    if (renglon.costoPorUnidad == null) return suma;

    return suma + (renglon.costoPorUnidad * renglon.cantidad) / QUANTITY_SCALE;
  }, 0);

  return Math.round(total);
}

export type Consumo = { ingredienteId: string; cantidad: number };

/**
 * Qué consume producir `unidades` de este producto.
 *
 * Una cantidad de cero o negativa no consume nada: producir en negativo sería
 * una forma de inflar el stock de insumos sin comprarlos.
 */
export function consumoDeProduccion(receta: RenglonDeReceta[], unidades: number): Consumo[] {
  if (unidades <= 0) return [];

  return receta.map((renglon) => ({
    ingredienteId: renglon.ingredienteId,
    cantidad: renglon.cantidad * unidades,
  }));
}

export type Faltante = { ingredienteId: string; falta: number };

/**
 * Qué insumos no alcanzan para producir, y CUÁNTO falta de cada uno.
 *
 * Devolver la diferencia y no solo "falta" es la diferencia entre un aviso
 * accionable y uno inútil: el panadero necesita saber si le faltan 200 gramos
 * o 20 kilos para decidir si sale a comprar o cambia el plan del día.
 */
export function faltantesParaProducir(
  receta: RenglonDeReceta[],
  unidades: number,
  stock: Record<string, number>,
): Faltante[] {
  return consumoDeProduccion(receta, unidades)
    .map((necesario) => ({
      ingredienteId: necesario.ingredienteId,
      // Un insumo que nunca se cargó cuenta como cero: no es lo mismo que "no
      // hay", pero para producir da igual.
      falta: necesario.cantidad - (stock[necesario.ingredienteId] ?? 0),
    }))
    .filter((f) => f.falta > 0);
}

export type RenglonDesglosado = RenglonDeReceta & {
  /** Lo que cuesta este insumo en UNA unidad del producto. */
  costo: number;
  /** Qué parte del costo total se lleva, en porcentaje entero. */
  porcentaje: number;
  /** Si el insumo todavía no tiene costo cargado y por eso suma cero. */
  sinCosto: boolean;
};

/**
 * La receta con el peso de cada insumo en el costo.
 *
 * El total solo dice cuánto sale; el desglose dice DÓNDE se va la plata, que es
 * lo que decide qué conviene negociar con el proveedor. Sin esto hay que
 * dividir a mano renglón por renglón.
 */
export function desglosarReceta(receta: RenglonDeReceta[]): {
  renglones: RenglonDesglosado[];
  total: number;
  /** Cuántos insumos no tienen costo: el total está incompleto por esos. */
  sinCostear: number;
} {
  const total = costoDeReceta(receta);

  return {
    total,
    sinCostear: receta.filter((renglon) => renglon.costoPorUnidad == null).length,
    renglones: receta.map((renglon) => {
      const costo =
        renglon.costoPorUnidad == null
          ? 0
          : Math.round((renglon.costoPorUnidad * renglon.cantidad) / QUANTITY_SCALE);

      return {
        ...renglon,
        costo,
        // Sobre cero no se puede repartir nada: sin esto sería una división por
        // cero y saldría NaN impreso en pantalla.
        porcentaje: total === 0 ? 0 : Math.round((costo / total) * 100),
        sinCosto: renglon.costoPorUnidad == null,
      };
    }),
  };
}

/**
 * Qué queda de vender uno, sabiendo lo que cuesta hacerlo.
 *
 * `null` cuando falta el precio: sin precio no hay margen que calcular, y
 * mostrar "0%" haría creer que se vende a pérdida.
 */
export function margenDeProducto(
  precio: number | null,
  costo: number,
): { ganancia: number; porcentaje: number } | null {
  if (precio === null || precio <= 0) return null;

  const ganancia = precio - costo;
  // Sobre el precio, igual que en el resto de la app: "de cada 100 que entran,
  // cuántos quedan".
  return { ganancia, porcentaje: Math.round((ganancia / precio) * 100) };
}
