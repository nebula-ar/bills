// Ganancia de verdad, que no es "ventas menos lo que salió".
//
// Comprar mercadería no es un gasto: es cambiar plata por stock. La plata sale,
// sí, pero lo comprado sigue siendo del negocio y está en la góndola. Recién se
// vuelve costo cuando se vende. Contarlo como gasto del mes en que se compró
// hace que un mes de reposición fuerte parezca pérdida y que el mes siguiente
// —cuando se vende eso mismo— parezca un golazo. Es ruido, no información.
//
//   Ganancia = ventas − costo de lo vendido − gastos operativos
//
// El costo de lo vendido sale de `SaleItem.unitCost`, que se congela al vender
// justamente para esto. Los gastos operativos son los que no dejan nada atrás:
// alquiler, sueldos, luz. La mercadería (categoría MERCHANDISE y las facturas
// de proveedor) queda afuera: la descuenta la venta, no la compra.
//
// Lo que queda sin vender no desaparece de la foto, cambia de lugar: es
// patrimonio, y se muestra aparte como "en mercadería".

export type ProfitInput = {
  // Lo facturado en el período.
  revenue: number;
  // Plata devuelta a clientes en el período (baja la venta).
  returnedRevenue: number;
  // Costo congelado de todo lo que se vendió.
  soldCost: number;
  // Costo de lo devuelto, que volvió al stock y por lo tanto deja de ser costo.
  returnedCost: number;
  // Gastos que no dejan nada atrás. Sin mercadería.
  operatingExpenses: number;
  // Mercadería que se perdió: merma, rotura, vencimiento, faltantes de conteo.
  // Se compró y no se va a vender nunca: es pérdida del período.
  inventoryLosses: number;
};

export type Profit = {
  netRevenue: number;
  costOfGoodsSold: number;
  operatingExpenses: number;
  inventoryLosses: number;
  profit: number;
  // Cuánto de cada peso vendido queda como ganancia. null si no se vendió nada:
  // dividir por cero no es "0% de margen", es que no hay nada que medir.
  marginPct: number | null;
};

export function computeProfit(input: ProfitInput): Profit {
  const netRevenue = input.revenue - input.returnedRevenue;
  const costOfGoodsSold = input.soldCost - input.returnedCost;
  const profit = netRevenue - costOfGoodsSold - input.operatingExpenses - input.inventoryLosses;

  return {
    netRevenue,
    costOfGoodsSold,
    operatingExpenses: input.operatingExpenses,
    inventoryLosses: input.inventoryLosses,
    profit,
    marginPct: netRevenue > 0 ? Math.round((profit / netRevenue) * 100) : null,
  };
}

// Los gastos del período que sí bajan la ganancia. La mercadería comprada al
// contado se carga como gasto porque es el atajo del que va al mayorista y no
// quiere cargar factura, pero no es un gasto del mes: es stock.
export function operatingExpensesOf(
  byCategory: { category: string; total: number }[],
  merchandiseCategory: string,
): number {
  return byCategory
    .filter((row) => row.category !== merchandiseCategory)
    .reduce((total, row) => total + row.total, 0);
}
