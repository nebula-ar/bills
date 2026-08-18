import { Unit } from "@/generated/prisma/enums";

/**
 * Cómo se le habla al dueño según cómo mide el insumo.
 *
 * Un "Ej: 12" en un campo de kilos no le dice nada al panadero: él tiene
 * delante una bolsa de 25 kg y una factura, y el ejemplo tiene que ser ESE
 * número. La etiqueta genérica ("¿Cuántos tenés?") lo obliga a mirar el
 * selector de unidad para saber en qué está tipeando; nombrar la unidad en la
 * pregunta le saca ese viaje de encima.
 *
 * El ejemplo además NO es decorativo: en las unidades que no admiten fracciones
 * (ver `FRACTIONAL_UNITS` en src/lib/quantity.ts) sugerir "1,5" sería enseñarle
 * a tipear algo que el parser devuelve como null y que se pierde sin aviso. Por
 * eso los decimales aparecen solo donde de verdad se pueden usar.
 */

export type TextosDeInsumo = {
  /** Etiqueta del campo de existencia: "¿Cuántos kilos tenés?" */
  cuantoHay: string;
  /** Etiqueta del campo de bulto: "¿Cuántos kilos trae?" */
  cuantoTrae: string;
  /** Ejemplo de existencia, con decimales solo donde se admiten. */
  ejemploCantidad: string;
  /** Ejemplo del contenido de un bulto típico de esa unidad. */
  ejemploBulto: string;
  /** Cómo se nombra una unidad al explicar el costo: "el kilo", "la unidad". */
  porUnidad: string;
};

const TEXTOS: Record<Unit, TextosDeInsumo> = {
  [Unit.KG]: {
    cuantoHay: "¿Cuántos kilos tenés?",
    cuantoTrae: "¿Cuántos kilos trae?",
    ejemploCantidad: "Ej: 25,5",
    // La bolsa de harina, que es el caso que más se carga en una panadería.
    ejemploBulto: "Ej: 25",
    porUnidad: "el kilo",
  },
  [Unit.GRAM]: {
    cuantoHay: "¿Cuántos gramos tenés?",
    cuantoTrae: "¿Cuántos gramos trae?",
    ejemploCantidad: "Ej: 750,5",
    // El sobre de levadura o la lata de esencia: se compran en cientos de gramos.
    ejemploBulto: "Ej: 500",
    porUnidad: "el gramo",
  },
  [Unit.LITER]: {
    cuantoHay: "¿Cuántos litros tenés?",
    cuantoTrae: "¿Cuántos litros trae?",
    ejemploCantidad: "Ej: 10,5",
    // El bidón de aceite.
    ejemploBulto: "Ej: 5",
    porUnidad: "el litro",
  },
  [Unit.METER]: {
    cuantoHay: "¿Cuántos metros tenés?",
    cuantoTrae: "¿Cuántos metros trae?",
    ejemploCantidad: "Ej: 12,5",
    // El rollo de tela o de papel.
    ejemploBulto: "Ej: 50",
    porUnidad: "el metro",
  },
  [Unit.UNIT]: {
    cuantoHay: "¿Cuántas unidades tenés?",
    cuantoTrae: "¿Cuántas unidades trae?",
    // Sin coma: `UNIT` no admite fracciones y sugerirlas es enseñar a perder el
    // dato.
    ejemploCantidad: "Ej: 60",
    // El maple de huevos.
    ejemploBulto: "Ej: 30",
    porUnidad: "la unidad",
  },
  [Unit.PACK]: {
    cuantoHay: "¿Cuántos paquetes tenés?",
    cuantoTrae: "¿Cuántos paquetes trae?",
    ejemploCantidad: "Ej: 8",
    ejemploBulto: "Ej: 6",
    porUnidad: "el paquete",
  },
  [Unit.DOZEN]: {
    cuantoHay: "¿Cuántas docenas tenés?",
    cuantoTrae: "¿Cuántas docenas trae?",
    ejemploCantidad: "Ej: 4",
    ejemploBulto: "Ej: 12",
    porUnidad: "la docena",
  },
};

export function textosDeInsumo(unit: Unit): TextosDeInsumo {
  return TEXTOS[unit];
}
