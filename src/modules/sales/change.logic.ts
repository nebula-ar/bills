// Vuelto y billetes.
//
// Es la cuenta que hoy hace el vendedor de cabeza con el cliente enfrente, y la
// que más se equivoca cuando hay apuro. Que la haga el sistema no es comodidad:
// un vuelto mal dado es plata que falta en la caja a la noche.
//
// Lógica pura: entra el total y lo que el cliente dio, sale lo que hay que
// devolver. Sin Prisma y sin `new Date()`.

// Billetes que circulan de verdad en Argentina. No están los de $10 ni $50
// porque no se ven en un mostrador.
const BILLETES = [1_000, 2_000, 5_000, 10_000, 20_000];

export function changeFor(total: number, received: number): number {
  return Math.max(0, Math.trunc(received) - Math.trunc(total));
}

// ¿Alcanza para cobrar?
export function coversTotal(total: number, received: number): boolean {
  return Math.trunc(received) >= Math.trunc(total);
}

// Atajos de "¿con cuánto paga?": el total justo primero, y después los montos
// redondos con los que la gente realmente paga. Se ofrecen de menor a mayor y
// nunca más de cuatro, para que la fila entre en el ancho del celular.
export function quickCashAmounts(total: number, limit = 4): number[] {
  if (total <= 0) {
    return [];
  }

  const amounts = new Set<number>();

  // Redondeos hacia arriba del propio total: si son $12.400, ofrecer $13.000 y
  // $15.000 antes que un billete de $20.000.
  for (const step of [1_000, 5_000, 10_000]) {
    const rounded = Math.ceil(total / step) * step;
    if (rounded > total) {
      amounts.add(rounded);
    }
  }

  // Y los billetes que alcanzan.
  for (const bill of BILLETES) {
    if (bill > total) {
      amounts.add(bill);
    }
  }

  return [...amounts].sort((a, b) => a - b).slice(0, limit);
}
