import {
  ExpenseCategory,
  KdsStatus,
  PaymentMethod,
  PromotionType,
  UserRole,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteBusinessTransfer } from "@/modules/cash/cash.use-cases";
import { deleteBusinessExpense } from "@/modules/expenses/expense.use-cases";
import { deletePromotion, togglePromotion } from "@/modules/promotions/promotion.use-cases";
import { getReturnableSale } from "@/modules/sales/return-sale.use-case";
import { getBranchStockOverview } from "@/modules/stock/stock.use-cases";
import { deletePurchase, deleteSupplier, getPurchaseDetail } from "@/modules/suppliers/supplier.use-cases";
import { getOrderForCheckout } from "@/modules/tables/orders.use-cases";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { borrarNegociosDePrueba, crearInquilinos, enTandas, type Inquilino } from "./inquilinos";

/**
 * Los siete módulos donde vive la plata.
 *
 * Catálogo y clientes ya tienen su archivo. Acá van ventas, comandas,
 * proveedores, caja, gastos, promociones y stock — todo lo que quedaba sin
 * cobertura de aislamiento, que es exactamente donde una fuga duele más: no
 * muestra precios, muestra cuánto factura y cuánto debe el negocio de al lado.
 *
 * Dos formas de assert, y la segunda es la que importa:
 *
 *   1. Que la operación ajena FALLE (o devuelva vacío).
 *   2. Que la base NO se haya movido.
 *
 * La segunda existe porque un caso de uso puede escribir y DESPUÉS tirar. Si
 * solo se mirara la excepción, ese caso pasaría el test con el dato ya pisado.
 */

const INQUILINOS = 6;
const TANDA = 3;

type Operacion = {
  staffId: string;
  saleId: string;
  orderId: string;
  supplierId: string;
  purchaseId: string;
  transferId: string;
  expenseId: string;
  promotionId: string;
};

let inquilinos: Inquilino[] = [];
let ops: Operacion[] = [];

function vecino(indice: number): number {
  return (indice + 1) % INQUILINOS;
}

/** Cuenta las filas vivas de cada tabla que estos tests pueden llegar a tocar. */
async function censo() {
  const ids = {
    supplier: ops.map((o) => o.supplierId),
    purchase: ops.map((o) => o.purchaseId),
    transfer: ops.map((o) => o.transferId),
    expense: ops.map((o) => o.expenseId),
    promotion: ops.map((o) => o.promotionId),
  };

  const [supplier, purchase, transfer, expense, promotion, promoActivas] = await Promise.all([
    prisma.supplier.count({ where: { id: { in: ids.supplier }, deleted: false } }),
    prisma.purchase.count({ where: { id: { in: ids.purchase }, deleted: false } }),
    prisma.accountTransfer.count({ where: { id: { in: ids.transfer }, deleted: false } }),
    prisma.expense.count({ where: { id: { in: ids.expense }, deleted: false } }),
    prisma.promotion.count({ where: { id: { in: ids.promotion }, deleted: false } }),
    prisma.promotion.count({ where: { id: { in: ids.promotion }, active: true } }),
  ]);

  return { supplier, purchase, transfer, expense, promotion, promoActivas };
}

beforeAll(async () => {
  inquilinos = await crearInquilinos(INQUILINOS, 2);

  ops = await enTandas(inquilinos, TANDA, async (inquilino, indice) => {
    const { businessId, branchId } = inquilino;

    // Un empleado: `Sale.staffId` es obligatorio. Es una fila de datos, no una
    // cuenta — no lleva contraseña ni PIN.
    const staff = await prisma.user.create({
      data: { businessId, branchId, name: `E2E-Empleado ${indice}`, role: UserRole.STAFF },
      select: { id: true },
    });

    // El monto de cada cosa lleva el índice del dueño: si aparece un número que
    // no es el propio, se sabe exactamente de quién se filtró.
    const marca = 100_000 + indice;

    const [sale, mesa, supplier, transfer, expense, promotion] = await Promise.all([
      prisma.sale.create({ data: { branchId, staffId: staff.id, total: marca }, select: { id: true } }),
      prisma.table.create({
        data: { businessId, branchId, name: `E2E-Mesa ${indice}` },
        select: { id: true },
      }),
      prisma.supplier.create({
        data: { businessId, name: `E2E-Proveedor ${indice}` },
        select: { id: true },
      }),
      prisma.accountTransfer.create({
        data: {
          businessId,
          fromMethod: PaymentMethod.CASH,
          toMethod: PaymentMethod.TRANSFER,
          amount: marca,
        },
        select: { id: true },
      }),
      prisma.expense.create({
        data: { businessId, category: ExpenseCategory.RENT, amount: marca },
        select: { id: true },
      }),
      prisma.promotion.create({
        data: {
          businessId,
          name: `E2E-Promo ${indice}`,
          type: PromotionType.PERCENT_OFF,
          active: true,
        },
        select: { id: true },
      }),
    ]);

    // La comanda va DESPUÉS de la mesa: `getOrderForCheckout` devuelve null si
    // la comanda no tiene mesa (sin mesa no hay nada que liberar al cobrar).
    const order = await prisma.order.create({
      data: { businessId, branchId, number: 9000 + indice, tableId: mesa.id, staffId: staff.id },
      select: { id: true },
    });

    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: inquilino.productIds[0]!,
        description: `E2E-Renglón ${indice}`,
        unitPrice: marca,
        total: marca,
        // Fuera de CART a propósito: la consulta del cobro descarta los
        // renglones que el cliente cargó por QR y el mozo todavía no confirmó.
        kdsStatus: KdsStatus.PENDING,
      },
    });

    const purchase = await prisma.purchase.create({
      data: { businessId, supplierId: supplier.id, total: marca },
      select: { id: true },
    });

    // Existencia del primer producto: sin esto el resumen de stock viene vacío
    // y el test de abajo no probaría nada.
    await prisma.stockLevel.create({
      data: { branchId, productId: inquilino.productIds[0]!, quantity: (indice + 1) * 1000 },
    });

    return {
      staffId: staff.id,
      saleId: sale.id,
      orderId: order.id,
      supplierId: supplier.id,
      purchaseId: purchase.id,
      transferId: transfer.id,
      expenseId: expense.id,
      promotionId: promotion.id,
    };
  });
});

afterAll(async () => {
  await borrarNegociosDePrueba();
  await prisma.$disconnect();
});

describe("Aislamiento: lecturas", () => {
  test("ventas — la venta de otro negocio no se puede devolver", async () => {
    // `/ventas/<id>/devolver` con el id de una venta ajena. Si abriera, se ven
    // renglones, montos y forma de pago del otro negocio.
    const ajenas = await enTandas(inquilinos, TANDA, async (inquilino, indice) => {
      try {
        return await getReturnableSale(ops[vecino(indice)]!.saleId, inquilino.businessId);
      } catch {
        return null;
      }
    });
    expect(ajenas.every((venta) => venta === null || venta === undefined)).toBe(true);

    // Y la propia SÍ, para que el test no pase por estar todo roto.
    const propias = await enTandas(inquilinos, TANDA, (inquilino, indice) =>
      getReturnableSale(ops[indice]!.saleId, inquilino.businessId),
    );
    propias.forEach((venta, indice) => {
      expect(venta).toBeTruthy();
      expect(venta!.total).toBe(100_000 + indice);
    });
  });

  test("comandas — la comanda de otro negocio no se puede cobrar", async () => {
    const ajenas = await enTandas(inquilinos, TANDA, async (inquilino, indice) => {
      try {
        return await getOrderForCheckout(inquilino.businessId, ops[vecino(indice)]!.orderId);
      } catch {
        return null;
      }
    });
    expect(ajenas.every((comanda) => comanda === null || comanda === undefined)).toBe(true);

    const propias = await enTandas(inquilinos, TANDA, (inquilino, indice) =>
      getOrderForCheckout(inquilino.businessId, ops[indice]!.orderId),
    );
    propias.forEach((comanda) => expect(comanda).toBeTruthy());
  });

  test("proveedores — la factura de otro negocio no se abre", async () => {
    const ajenas = await enTandas(inquilinos, TANDA, async (inquilino, indice) => {
      try {
        return await getPurchaseDetail(ops[vecino(indice)]!.purchaseId, inquilino.businessId);
      } catch {
        return null;
      }
    });
    expect(ajenas.every((compra) => compra === null || compra === undefined)).toBe(true);

    const propias = await enTandas(inquilinos, TANDA, (inquilino, indice) =>
      getPurchaseDetail(ops[indice]!.purchaseId, inquilino.businessId),
    );
    propias.forEach((compra, indice) => {
      expect(compra).toBeTruthy();
      expect(compra!.total).toBe(100_000 + indice);
    });
  });

  test("stock — el resumen de una sucursal ajena no trae existencias", async () => {
    const ajenos = await enTandas(inquilinos, TANDA, async (inquilino, indice) => {
      try {
        return await getBranchStockOverview(inquilino.businessId, inquilinos[vecino(indice)]!.branchId);
      } catch {
        return null;
      }
    });

    ajenos.forEach((resumen, indice) => {
      if (resumen === null) return;
      const ajeno = inquilinos[vecino(indice)]!;
      const ids = JSON.stringify(resumen);
      // Ni el producto ni la sucursal del vecino pueden aparecer, en ninguna
      // parte de la respuesta.
      for (const productId of ajeno.productIds) {
        expect(ids).not.toContain(productId);
      }
      expect(ids).not.toContain(ajeno.branchId);
    });
  });
});

describe("Aislamiento: escrituras", () => {
  test("borrar cosas ajenas no borra nada", async () => {
    const antes = await censo();

    // Los cinco borrados en paralelo, cada inquilino apuntando al vecino. Es el
    // caso más destructivo posible: si alguno pasa, un cliente le vacía la
    // contabilidad a otro.
    const intentos = await enTandas(inquilinos, TANDA, async (inquilino, indice) => {
      const ajeno = ops[vecino(indice)]!;
      const businessId = inquilino.businessId;

      const resultados = await Promise.allSettled([
        deleteSupplier(ajeno.supplierId, businessId),
        deletePurchase(ajeno.purchaseId, businessId),
        deleteBusinessTransfer({ businessId, transferId: ajeno.transferId }),
        deleteBusinessExpense({ businessId, expenseId: ajeno.expenseId }),
        deletePromotion(ajeno.promotionId, businessId),
      ]);

      return resultados.filter((r) => r.status === "fulfilled").length;
    });

    const despues = await censo();

    // El assert que manda: nada se movió. Que alguna llamada no haya tirado no
    // es en sí un problema —un `updateMany` que afecta 0 filas es fail-closed y
    // no lanza—; lo que sería un problema es que la fila desapareciera.
    expect(despues).toEqual(antes);
    expect(despues.supplier).toBe(INQUILINOS);
    expect(despues.purchase).toBe(INQUILINOS);
    expect(despues.transfer).toBe(INQUILINOS);
    expect(despues.expense).toBe(INQUILINOS);
    expect(despues.promotion).toBe(INQUILINOS);

    // Y que el conteo no sea casualidad de que nadie llamó nada.
    expect(intentos.length).toBe(INQUILINOS);
  });

  test("apagar la promoción de otro negocio no la apaga", async () => {
    const antes = await censo();
    expect(antes.promoActivas).toBe(INQUILINOS);

    await enTandas(inquilinos, TANDA, async (inquilino, indice) => {
      try {
        await togglePromotion(ops[vecino(indice)]!.promotionId, inquilino.businessId, false);
      } catch {
        /* esperado */
      }
    });

    const despues = await censo();
    expect(despues.promoActivas).toBe(INQUILINOS);
  });

  test("borrar lo PROPIO sí funciona", async () => {
    // El contraejemplo. Sin esto, un caso de uso que se negara SIEMPRE pasaría
    // todos los tests de arriba y habría roto la app sin que nadie se entere.
    await enTandas(inquilinos, TANDA, (inquilino, indice) =>
      deleteBusinessExpense({ businessId: inquilino.businessId, expenseId: ops[indice]!.expenseId }),
    );

    const vivos = await prisma.expense.count({
      where: { id: { in: ops.map((o) => o.expenseId) }, deleted: false },
    });
    expect(vivos).toBe(0);
  });
});
