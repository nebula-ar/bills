import { prisma } from "@/lib/prisma";
import { PaymentMethod, SaleChannel, SaleStatus, StockMovementType, TaxCondition, Unit, UserRole } from "@/generated/prisma/client";
import { chargeCustomerAccount, reverseCustomerCharge } from "@/modules/customers/customer.repository";
import { applyStockMovement } from "@/modules/stock/stock.repository";

import type { CreateSalePaymentDto } from "./create-sale.dto";

export type CreateSaleRepositoryItem = {
  productId: string | null;
  description: string;
  // En milésimas (ver src/lib/quantity.ts).
  quantity: number;
  unit: Unit;
  unitPrice: number;
  // Parte del descuento por promociones que le toca a este renglón.
  discount: number;
  total: number;
  // Costo congelado al momento de vender, para poder calcular margen histórico.
  unitCost: number | null;
  // Si descuenta stock al vender. Se resuelve en el caso de uso, no acá.
  trackStock: boolean;
};

export type CreateSaleDiscountInput = {
  promotionId: string | null;
  description: string;
  amount: number;
};

export type CreateSaleRepositoryInput = {
  branchId: string;
  staffId: string;
  terminalId?: string | null;
  customerId?: string | null;
  subtotal: number;
  discountTotal: number;
  total: number;
  items: CreateSaleRepositoryItem[];
  payments: CreateSalePaymentDto[];
  discounts: CreateSaleDiscountInput[];
  // Monto cobrado en cuenta corriente (fiado). 0 si se cobró todo al contado.
  accountCharge: number;
  // Puntos que deja la venta (programa de fidelidad). 0 = no suma.
  loyaltyPoints?: number;
  businessId?: string;
  notes?: string;
  soldAt?: Date;
  customerName?: string;
  customerTaxId?: string;
  customerTaxCondition?: TaxCondition;
  channel?: SaleChannel;
  tableName?: string | null;
  waiterName?: string | null;
  tip?: number;
  userId?: string | null;
};

export type CancelSaleRepositoryInput = {
  saleId: string;
  branchId: string;
  notes?: string;
  // Renglones cuyo stock hay que devolver (cantidad positiva).
  restockItems: { productId: string; quantity: number; unitCost: number | null }[];
  customerId: string | null;
  accountCharge: number;
  userId?: string | null;
};

export function findSaleBranch(branchId: string) {
  return prisma.branch.findFirst({
    where: {
      id: branchId,
      active: true,
      deleted: false,
    },
  });
}

export function findSaleStaff(staffId: string) {
  return prisma.user.findUnique({
    where: {
      id: staffId,
    },
  });
}

export function findBranchProductPrices(branchId: string, productIds: string[]) {
  return prisma.branchProductPrice.findMany({
    where: {
      branchId,
      productId: {
        in: productIds,
      },
      active: true,
      deleted: false,
      product: {
        active: true,
        deleted: false,
      },
    },
    include: {
      product: true,
    },
  });
}

export function findSaleEntryOptionsBranch(branchId?: string) {
  return prisma.branch.findFirst({
    where: {
      ...(branchId ? { id: branchId } : {}),
      deleted: false,
      active: true,
      business: {
        deleted: false,
      },
      users: {
        some: {
          deleted: false,
          active: true,
          role: UserRole.STAFF,
        },
      },
      productPrices: {
        some: {
          deleted: false,
          active: true,
          product: {
            deleted: false,
            active: true,
          },
        },
      },
    },
    include: {
      business: {
        select: {
          name: true,
          // El rubro define cómo se llama lo que se vende. La terminal decía
          // "servicio" en una panadería porque no lo tenía.
          vertical: true,
        },
      },
      users: {
        where: {
          deleted: false,
          active: true,
          role: UserRole.STAFF,
        },
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
          canCloseCash: true,
        },
      },
      productPrices: {
        where: {
          deleted: false,
          active: true,
          product: {
            deleted: false,
            active: true,
          },
        },
        include: {
          product: {
            select: {
              name: true,
              unit: true,
              sku: true,
              barcode: true,
              trackStock: true,
              imageUpdatedAt: true,
              catalogSlug: true,
              packSize: true,
              packLabel: true,
              familyId: true,
              variantLabel: true,
              family: { select: { name: true } },
            },
          },
        },
        orderBy: {
          product: {
            name: "asc",
          },
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });
}

// Todas las sucursales activas con empleados y servicios, para el checkout del POS.
// Por qué el mostrador no tiene ninguna sucursal para ofrecer.
//
// `findSaleEntryBranches` pide tres cosas a la vez —sucursal activa, con algún
// empleado, con algún producto con precio— y devuelve vacío si falta cualquiera.
// Sin esto la pantalla tenía que adivinar y siempre culpaba a la sucursal, que
// después del alta es justamente lo único que YA está: lo que falta es el
// catálogo, y mandarlo a Sucursales lo deja dando vueltas.
export async function diagnoseNoSaleBranches(businessId: string) {
  const [branches, staffs, pricedProducts] = await Promise.all([
    prisma.branch.count({ where: { businessId, deleted: false, active: true } }),
    prisma.user.count({ where: { businessId, deleted: false, active: true, role: UserRole.STAFF } }),
    prisma.branchProductPrice.count({
      where: {
        deleted: false,
        active: true,
        branch: { businessId, deleted: false, active: true },
        product: { deleted: false, active: true },
      },
    }),
  ]);

  return { hasBranch: branches > 0, hasStaff: staffs > 0, hasPricedProduct: pricedProducts > 0 };
}

export function findSaleEntryBranches(businessId: string) {
  return prisma.branch.findMany({
    where: {
      businessId,
      deleted: false,
      active: true,
      business: {
        deleted: false,
      },
      users: {
        some: {
          deleted: false,
          active: true,
          role: UserRole.STAFF,
        },
      },
      productPrices: {
        some: {
          deleted: false,
          active: true,
          product: {
            deleted: false,
            active: true,
          },
        },
      },
    },
    include: {
      business: {
        select: {
          name: true,
        },
      },
      users: {
        where: {
          deleted: false,
          active: true,
          role: UserRole.STAFF,
        },
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
          canCloseCash: true,
        },
      },
      productPrices: {
        where: {
          deleted: false,
          active: true,
          product: {
            deleted: false,
            active: true,
          },
        },
        include: {
          product: {
            select: {
              name: true,
              unit: true,
              sku: true,
              barcode: true,
              trackStock: true,
              imageUpdatedAt: true,
              catalogSlug: true,
              packSize: true,
              packLabel: true,
              familyId: true,
              variantLabel: true,
              family: { select: { name: true } },
              // Para los chips de categoría del POS: con muchos productos,
              // buscar por nombre no alcanza.
              category: { select: { name: true, color: true } },
            },
          },
        },
        orderBy: {
          product: {
            name: "asc",
          },
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });
}

/** Desde inclusive, hasta exclusive (ver sales-period.logic). */
export type RangoDeVentas = { desde: Date; hasta: Date };

/**
 * Todas las ventas del período, con lo mínimo para totalizar.
 *
 * Va aparte de `findRecentSales` porque los totales tienen que cubrir el
 * período ENTERO, no la primera página: un total que cambia al tocar "cargar
 * más" no es un total. Por eso también trae solo total, estado y pagos, sin
 * renglones ni datos fiscales.
 */
export function findSalesForSummary(businessId: string, rango: RangoDeVentas) {
  return prisma.sale.findMany({
    where: {
      deleted: false,
      soldAt: { gte: rango.desde, lt: rango.hasta },
      branch: { businessId, deleted: false, active: true },
      staff: { deleted: false },
    },
    select: {
      total: true,
      status: true,
      payments: { select: { method: true, amount: true } },
    },
  });
}

export function findRecentSales(
  businessId: string,
  limit = 10,
  cursor?: string,
  rango?: RangoDeVentas,
  metodo?: PaymentMethod,
) {
  return prisma.sale.findMany({
    where: {
      deleted: false,
      ...(rango ? { soldAt: { gte: rango.desde, lt: rango.hasta } } : {}),
      // `some` y no `every`: una venta con pago dividido en efectivo y QR se
      // pagó con los dos, y tiene que salir en los dos filtros.
      ...(metodo ? { payments: { some: { method: metodo } } } : {}),
      branch: {
        businessId,
        deleted: false,
        active: true,
      },
      staff: {
        deleted: false,
      },
    },
    take: limit,
    // Paginación por cursor: arrancamos después de la última venta ya mostrada.
    // El orderBy incluye `id` para un orden determinístico (dos ventas pueden
    // compartir soldAt).
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ soldAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      soldAt: true,
      total: true,
      status: true,
      notes: true,
      customerName: true,
      customerTaxId: true,
      customerTaxCondition: true,
      invoiceType: true,
      afipStatus: true,
      cae: true,
      caeVencimiento: true,
      afipVoucherNumber: true,
      afipError: true,
      branch: {
        select: {
          name: true,
        },
      },
      staff: {
        select: {
          name: true,
        },
      },
      customer: {
        select: {
          name: true,
          phone: true,
        },
      },
      items: {
        where: {
          deleted: false,
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          description: true,
          quantity: true,
          total: true,
        },
      },
      payments: {
        where: {
          deleted: false,
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          method: true,
          amount: true,
        },
      },
    },
  });
}

export function findStaffSalesInRange(input: { branchId: string; staffId: string; start: Date; end: Date }) {
  return prisma.sale.findMany({
    where: {
      deleted: false,
      branchId: input.branchId,
      staffId: input.staffId,
      soldAt: {
        gte: input.start,
        lt: input.end,
      },
    },
    orderBy: {
      soldAt: "desc",
    },
    select: {
      id: true,
      soldAt: true,
      total: true,
      status: true,
      items: {
        where: {
          deleted: false,
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          description: true,
          quantity: true,
        },
      },
      payments: {
        where: {
          deleted: false,
        },
        select: {
          id: true,
          method: true,
        },
      },
    },
  });
}

// Para anular hay que saber qué deshacer: qué stock devolver y qué deuda borrar.
// La anulación se scoping por negocio cuando se conoce (businessId): un call a
// la action de otra empresa no puede anular ventas ajenas. `businessId`
// opcional para no romper callers que hoy no lo pasan (se agrega de a uno).
export function findSaleForCancellation(saleId: string, businessId?: string) {
  return prisma.sale.findFirst({
    where: {
      id: saleId,
      deleted: false,
      ...(businessId ? { branch: { businessId } } : {}),
    },
    select: {
      id: true,
      status: true,
      // Para rechazar la anulación de una venta con comprobante ya emitido
      // (SALE_HAS_ISSUED_INVOICE, ver cancel-sale.use-case).
      afipStatus: true,
      notes: true,
      branchId: true,
      customerId: true,
      soldAt: true,
      items: {
        where: { deleted: false },
        select: {
          productId: true,
          quantity: true,
          unitCost: true,
          product: { select: { trackStock: true } },
        },
      },
      payments: {
        where: { deleted: false },
        select: { method: true, amount: true },
      },
    },
  });
}

// Anular revierte todo lo que la venta produjo, en una sola transacción:
// devuelve el stock y da de baja el fiado. Los asientos originales no se
// tocan; se compensan (el libro tiene que seguir contando la historia entera).
export function cancelSaleTransaction(input: CancelSaleRepositoryInput) {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.update({
      where: { id: input.saleId },
      data: {
        status: SaleStatus.CANCELLED,
        notes: input.notes,
      },
    });

    for (const item of input.restockItems) {
      await applyStockMovement(tx, {
        branchId: input.branchId,
        productId: item.productId,
        type: StockMovementType.SALE_CANCELLED,
        quantity: item.quantity,
        unitCost: item.unitCost,
        reason: "Venta anulada",
        saleId: input.saleId,
        createdById: input.userId,
      });
    }

    if (input.customerId && input.accountCharge > 0) {
      await reverseCustomerCharge(tx, {
        customerId: input.customerId,
        branchId: input.branchId,
        amount: input.accountCharge,
        saleId: input.saleId,
        userId: input.userId,
      });
    }

    return sale;
  });
}

// Grabar una venta es un solo acto: los renglones, los pagos, los descuentos
// aplicados, la salida de stock y —si se fía— el cargo en la cuenta del
// cliente. O entra todo, o no entra nada.
export function createSaleTransaction(input: CreateSaleRepositoryInput) {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.create({
      data: {
        branchId: input.branchId,
        staffId: input.staffId,
        terminalId: input.terminalId ?? null,
        customerId: input.customerId ?? null,
        subtotal: input.subtotal,
        discountTotal: input.discountTotal,
        total: input.total,
        notes: input.notes,
        soldAt: input.soldAt,
        customerName: input.customerName,
        customerTaxId: input.customerTaxId,
        customerTaxCondition: input.customerTaxCondition,
        channel: input.channel,
        tableName: input.tableName,
        waiterName: input.waiterName,
        tip: input.tip ?? 0,
        items: {
          create: input.items.map((item) => ({
            productId: item.productId,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            discount: item.discount,
            unitCost: item.unitCost,
            total: item.total,
          })),
        },
        payments: {
          create: input.payments.map((payment) => ({
            method: payment.method,
            amount: payment.amount,
          })),
        },
        discounts: {
          create: input.discounts.map((discount) => ({
            promotionId: discount.promotionId,
            description: discount.description,
            amount: discount.amount,
          })),
        },
      },
      include: {
        items: true,
        payments: true,
        discounts: true,
      },
    });

    for (const item of input.items) {
      if (!item.productId || !item.trackStock) {
        continue;
      }

      await applyStockMovement(tx, {
        branchId: input.branchId,
        productId: item.productId,
        type: StockMovementType.SALE,
        quantity: -item.quantity,
        unitCost: item.unitCost,
        saleId: sale.id,
        occurredAt: input.soldAt,
        createdById: input.userId,
      });
    }

    if (input.customerId && input.accountCharge > 0) {
      await chargeCustomerAccount(tx, {
        customerId: input.customerId,
        branchId: input.branchId,
        amount: input.accountCharge,
        saleId: sale.id,
        occurredAt: input.soldAt,
        userId: input.userId,
      });
    }

    // Puntos de fidelidad: van acá adentro para que no puedan existir sin su
    // venta. El saldo es la suma del libro (ver loyalty.logic.ts).
    if (input.customerId && input.businessId && (input.loyaltyPoints ?? 0) > 0) {
      await tx.loyaltyEntry.create({
        data: {
          businessId: input.businessId,
          customerId: input.customerId,
          points: input.loyaltyPoints as number,
          saleId: sale.id,
          createdById: input.userId,
        },
      });
    }

    return sale;
  });
}

// Cuántas veces se vendió cada producto últimamente, por sucursal.
//
// Es lo que ordena la grilla del mostrador: el que atiende busca casi siempre
// las mismas diez cosas, y tenerlas alfabéticas lo obliga a buscar o a
// scrollear cada vez. Cuenta TICKETS y no unidades: un producto que aparece en
// muchas ventas es lo que se despacha seguido, aunque sea de a uno.
export async function findTopSellingProductIds(businessId: string, from: Date) {
  const rows = await prisma.saleItem.groupBy({
    by: ["productId"],
    where: {
      deleted: false,
      productId: { not: null },
      sale: {
        deleted: false,
        status: SaleStatus.COMPLETED,
        soldAt: { gte: from },
        branch: { businessId, deleted: false },
      },
    },
    _count: { _all: true },
  });

  return new Map(rows.map((row) => [row.productId as string, row._count._all]));
}
