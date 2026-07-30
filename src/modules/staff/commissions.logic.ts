// Cálculo de comisiones. Lógica pura: sin Prisma y sin fechas implícitas, para
// poder testear el redondeo y los casos molestos (empleado sin porcentaje, venta
// anulada, período sin ventas).
//
// La comisión se calcula sobre lo que el cliente REALMENTE pagó (el total con
// descuentos aplicados), no sobre el precio de lista. Si el negocio hace un 20%
// off, esa rebaja la absorben el negocio y el empleado, no solo el negocio.

export type CommissionSale = {
  staffId: string;
  // Total efectivamente cobrado por la venta, en pesos enteros.
  total: number;
};

export type CommissionStaff = {
  id: string;
  name: string;
  // Porcentaje sobre lo vendido, 0-100. En 0 el empleado no cobra comisión.
  commissionRate: number;
};

export type CommissionRow = {
  staffId: string;
  name: string;
  commissionRate: number;
  sales: number;
  sold: number;
  commission: number;
};

export type CommissionSummary = {
  rows: CommissionRow[];
  totalSold: number;
  totalCommission: number;
};

// Comisión de una venta: se redondea a peso entero (la app no maneja centavos).
export function commissionFor(total: number, rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0 || total <= 0) {
    return 0;
  }

  // Un porcentaje mayor a 100 sería un error de carga; lo acotamos en vez de
  // pagar más de lo que entró.
  const safeRate = Math.min(rate, 100);

  return Math.round((total * safeRate) / 100);
}

// Liquidación del período. Devuelve una fila por empleado —incluso por los que
// no vendieron nada—, porque al liquidar hay que ver a todo el equipo, no solo
// a los que aparecen.
export function summarizeCommissions(staff: CommissionStaff[], sales: CommissionSale[]): CommissionSummary {
  const byStaff = new Map<string, { sales: number; sold: number }>();

  for (const sale of sales) {
    const current = byStaff.get(sale.staffId) ?? { sales: 0, sold: 0 };
    current.sales += 1;
    current.sold += sale.total;
    byStaff.set(sale.staffId, current);
  }

  const rows = staff
    .map((person) => {
      const totals = byStaff.get(person.id) ?? { sales: 0, sold: 0 };
      // La comisión se calcula sobre el total del período, no sumando la de cada
      // venta: así el redondeo se aplica una sola vez y no se acumula el error.
      const commission = commissionFor(totals.sold, person.commissionRate);

      return {
        staffId: person.id,
        name: person.name,
        commissionRate: person.commissionRate,
        sales: totals.sales,
        sold: totals.sold,
        commission,
      };
    })
    // Primero quien más vendió: es el orden en el que se mira una liquidación.
    .sort((a, b) => b.sold - a.sold || a.name.localeCompare(b.name));

  return {
    rows,
    totalSold: rows.reduce((sum, row) => sum + row.sold, 0),
    totalCommission: rows.reduce((sum, row) => sum + row.commission, 0),
  };
}
