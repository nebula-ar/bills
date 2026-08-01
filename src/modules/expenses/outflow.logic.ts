// Lo que sale del negocio no viene de una sola tabla.
//
// Un gasto es plata que ya salió: monto, cuenta y fecha, y listo. Una compra a
// proveedor es otra cosa: es una deuda, con vencimiento y a veces con
// mercadería atrás, y recién toca la caja cuando se paga (igual que el fiado
// del lado de las ventas, ver AGENTS.md). Las dos conviven y en la pantalla de
// Gastos se ven juntas, pero la plata se cuenta una sola vez.
//
// De acá sale la regla que evita el error caro: **el mes suma gastos y PAGOS,
// nunca el total de la factura**. Una factura de $100.000 pagada en tres veces
// suma $100.000 repartidos en los meses en que se pagó, no $100.000 el día que
// llegó más $100.000 en cuotas.

export type OutflowKind = "EXPENSE" | "PAYMENT";

// Un movimiento de plata que salió, ya sea un gasto suelto o el pago de una
// factura. `id` es único dentro de su `kind`, no entre los dos.
export type Outflow = {
  kind: OutflowKind;
  id: string;
  amount: number;
  occurredAt: Date;
};

// Ordena de lo más nuevo a lo más viejo. Empate de fecha: primero el gasto y
// después el pago, y dentro de cada uno por id, para que dos renders seguidos
// del mismo mes no barajen las filas.
export function buildOutflowTimeline<T extends Outflow>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    const byDate = b.occurredAt.getTime() - a.occurredAt.getTime();
    if (byDate !== 0) return byDate;
    if (a.kind !== b.kind) return a.kind === "EXPENSE" ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
}

export function sumOutflows(entries: Outflow[]): number {
  return entries.reduce((total, entry) => total + entry.amount, 0);
}
