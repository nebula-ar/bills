import { SaleChannel } from "@/generated/prisma/enums";

/**
 * Los pasos del cobro.
 *
 * Se calculan, no se listan fijos: un paso que siempre se contesta igual no es
 * un paso, es un toque de más antes de cobrar, y el que cobra hace esto
 * doscientas veces por día.
 *
 * La regla la manda el MÓDULO, no el rubro: un kiosco con salón prendido elige
 * dónde igual que una panadería, y una panadería sin salón no tiene por qué
 * verlo.
 */
export type PasoDeCobro = { key: "donde" | "mesa" | "pago" | "confirmar"; titulo: string };

export function pasosDelCobro(input: { usaSalon: boolean; canal: SaleChannel }): PasoDeCobro[] {
  return [
    ...(input.usaSalon ? ([{ key: "donde", titulo: "¿Dónde?" }] as const) : []),
    // La mesa solo se pregunta si ya se dijo que es una mesa. Preguntarla
    // siempre obligaría a saltearla en cada venta de mostrador.
    ...(input.usaSalon && input.canal === SaleChannel.TABLE
      ? ([{ key: "mesa", titulo: "¿Qué mesa?" }] as const)
      : []),
    { key: "pago", titulo: "¿Cómo paga?" },
    { key: "confirmar", titulo: "Confirmar" },
  ];
}

/**
 * Si se puede avanzar desde el paso actual.
 *
 * Frenar acá y no al confirmar es la diferencia entre "elegí la mesa" y "no se
 * pudo registrar la venta" con el cliente esperando.
 */
export function puedeAvanzar(input: {
  paso: PasoDeCobro["key"];
  tieneMesa: boolean;
  pagoValido: boolean;
}): boolean {
  if (input.paso === "mesa") return input.tieneMesa;
  if (input.paso === "pago") return input.pagoValido;
  return true;
}
