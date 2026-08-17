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
export type PasoDeCobro = {
  key: "donde" | "mesa" | "pago" | "efectivo" | "confirmar";
  titulo: string;
};

export function pasosDelCobro(input: {
  usaSalon: boolean;
  canal: SaleChannel;
  // Efectivo en un solo pago. Es lo único que necesita calcular vuelto: con
  // tarjeta se cobra justo, y en un pago dividido no hay un "con cuánto paga"
  // único porque son varios montos.
  pagaEnEfectivo: boolean;
  // El destino ya está decidido antes de abrir el cobro, así que "dónde" y "qué
  // mesa" no se preguntan: la respuesta ya está y volver a pedirla es un toque
  // de más con el cliente esperando.
  //
  // Se llamaba `mesaFija` porque el único caso era cobrar una comanda que ya
  // traía su mesa. Ahora el navbar del mostrador decide el destino ANTES de
  // cargar el primer producto, así que es siempre: los dos pasos quedaron sin
  // uso y el nombre viejo ya no describía nada.
  destinoYaElegido?: boolean;
}): PasoDeCobro[] {
  return [
    ...(input.usaSalon && !input.destinoYaElegido ? ([{ key: "donde", titulo: "¿Dónde?" }] as const) : []),
    // La mesa solo se pregunta si ya se dijo que es una mesa. Preguntarla
    // siempre obligaría a saltearla en cada venta de mostrador.
    ...(input.usaSalon && !input.destinoYaElegido && input.canal === SaleChannel.TABLE
      ? ([{ key: "mesa", titulo: "¿Qué mesa?" }] as const)
      : []),
    { key: "pago", titulo: "¿Cómo paga?" },
    // El vuelto tiene pantalla propia y va DESPUÉS de elegir el medio: recién
    // ahí se sabe si hace falta. Con débito este paso no existe.
    ...(input.pagaEnEfectivo ? ([{ key: "efectivo", titulo: "¿Con cuánto paga?" }] as const) : []),
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
