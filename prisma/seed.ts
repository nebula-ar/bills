import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

import {
  AppModule,
  CustomerAccountEntryType,
  EmailOwnershipStatus,
  ExpenseCategory,
  PaymentMethod,
  ProductKind,
  PromotionScope,
  PromotionType,
  PurchaseStatus,
  StockMovementType,
  Unit,
  UserRole,
  Vertical,
} from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";

// Datos de demo de un kiosco: el rubro que ejercita TODOS los módulos a la vez
// (stock por unidad y por peso, proveedores con vencimientos, promociones y
// fiado). Sirve para desarrollo y como base de datos de prueba.

// Días hacia atrás (incluye hoy) que cubre la data.
const SEED_DAYS = 15;
// Ventas a repartir en esos días (~12 por día).
const SALE_COUNT = 180;
// Milésimas por unidad (ver src/lib/quantity.ts). Se repite acá para que el seed
// no dependa del alias "@/".
const ONE = 1000;
const DEMO_OWNER_EMAIL = "owner@bills.local";
const DEMO_OWNER_PASSWORD = "admin123";

// Identidad del tenant demo. En modo local (Docker descartable) el seed borraba
// TODA la base; en Supabase Cloud esa base es compartida con datos de QA reales,
// así que el borrado va scoped a este negocio. El `publicToken` es único y fijo,
// lo que lo convierte en la llave estable para encontrar (y limpiar) el tenant.
const DEMO_BUSINESS_PUBLIC_TOKEN = "demo-kiosco-el-rulo";

type BranchSeed = { name: string; address: string };
type StaffSeed = { name: string; branchName: string; pin: string };

type ProductSeed = {
  name: string;
  category: string;
  price: number;
  kind?: ProductKind;
  unit?: Unit;
  cost?: number;
  stock?: number;
  minStock?: number;
  barcode?: string;
  // Venta por bulto: el kiosco compra y vende cajas enteras.
  packSize?: number;
  packLabel?: string;
};

const branchSeeds: BranchSeed[] = [
  { name: "Sucursal Centro", address: "Av. Corrientes 1234, CABA" },
  { name: "Sucursal Palermo", address: "Gorriti 4567, CABA" },
  { name: "Sucursal Norte", address: "Av. Maipú 890, Vicente López" },
];

const staffSeeds: StaffSeed[] = [
  { name: "Nico Fernández", branchName: "Sucursal Centro", pin: "1111" },
  { name: "Lucas Gómez", branchName: "Sucursal Centro", pin: "2222" },
  { name: "Fede González", branchName: "Sucursal Palermo", pin: "3333" },
  { name: "Matías Ruiz", branchName: "Sucursal Palermo", pin: "4444" },
  { name: "Franco Díaz", branchName: "Sucursal Norte", pin: "5555" },
  { name: "Nahuel Silva", branchName: "Sucursal Norte", pin: "6666" },
];

const categorySeeds = ["Golosinas", "Bebidas", "Snacks", "Almacén", "Servicios"];

const productSeeds: ProductSeed[] = [
  { name: "Alfajor triple", category: "Golosinas", price: 1800, cost: 1100, stock: 120, minStock: 20, barcode: "7790001000017" },
  { name: "Chicles", category: "Golosinas", price: 900, cost: 500, stock: 200, minStock: 40, barcode: "7790001000024" },
  { name: "Chocolate", category: "Golosinas", price: 2600, cost: 1600, stock: 80, minStock: 15, barcode: "7790001000031" },
  { name: "Gaseosa 500 ml", category: "Bebidas", price: 2200, cost: 1400, stock: 150, minStock: 30, barcode: "7790002000014", packSize: 12, packLabel: "Caja" },
  { name: "Agua saborizada 1,5 L", category: "Bebidas", price: 2800, cost: 1800, stock: 90, minStock: 20, barcode: "7790002000021" },
  { name: "Cerveza lata", category: "Bebidas", price: 3200, cost: 2100, stock: 110, minStock: 24, barcode: "7790002000038", packSize: 24, packLabel: "Cajón" },
  { name: "Papas fritas", category: "Snacks", price: 3200, cost: 2000, stock: 70, minStock: 15, barcode: "7790003000013" },
  { name: "Maní salado", category: "Snacks", price: 1900, cost: 1100, stock: 60, minStock: 12, barcode: "7790003000020" },
  // Vendidos por peso: ejercitan las cantidades fraccionarias de punta a punta.
  { name: "Fiambre cortado", category: "Almacén", price: 12_000, cost: 8000, unit: Unit.KG, stock: 25, minStock: 3 },
  { name: "Queso cremoso", category: "Almacén", price: 9500, cost: 6200, unit: Unit.KG, stock: 18, minStock: 3 },
  // Un servicio no descuenta existencias.
  { name: "Recarga de SUBE", category: "Servicios", price: 500, kind: ProductKind.SERVICE },
];

const branchPriceMultipliers: Record<string, number> = {
  "Sucursal Centro": 1,
  "Sucursal Palermo": 1.15,
  "Sucursal Norte": 0.95,
};

async function createDemoAuthUser(input: { businessId: string; userId: string }) {
  const url = process.env.SUPABASE_INTERNAL_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const environmentInstanceId = process.env.EXPECTED_ENVIRONMENT_INSTANCE_ID;
  if (!url || !serviceRoleKey || !environmentInstanceId) {
    throw new Error("El seed requiere Supabase y EXPECTED_ENVIRONMENT_INSTANCE_ID.");
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: existing, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
  if (listError) throw listError;
  const previous = existing.users.find((user) => user.email?.toLowerCase() === DEMO_OWNER_EMAIL);
  if (previous) {
    const { error } = await admin.auth.admin.deleteUser(previous.id);
    if (error) throw error;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: DEMO_OWNER_EMAIL,
    password: DEMO_OWNER_PASSWORD,
    email_confirm: true,
    app_metadata: {
      environment_instance_id: environmentInstanceId,
      bills_user_id: input.userId,
      bills_business_id: input.businessId,
      seeded_demo: true,
    },
  });
  if (error || !data.user) throw error ?? new Error("Supabase no devolvió el usuario demo.");
  return data.user;
}

// Borra el tenant demo completo respetando las FKs (hijos antes que padres).
// Filtra por businessId / branchId para no tocar los demás negocios de una base
// compartida (Supabase Cloud con datos de QA).
async function deleteDemoTenant() {
  const business = await prisma.business.findUnique({
    where: { publicToken: DEMO_BUSINESS_PUBLIC_TOKEN },
    select: { id: true },
  });
  if (!business) return;

  const { id: businessId } = business;

  // Las filas con FK hacia Branch (Sale, etc.) se borran por sucursal; el resto
  // del subárbol cuelga del negocio. Mismo orden que el borrado global histórico.
  const branches = await prisma.branch.findMany({
    where: { businessId },
    select: { id: true },
  });
  const branchIds = branches.map((branch) => branch.id);
  // Los IDs son cuid generados por Prisma (alfanuméricos): interpolarlos en SQL
  // no abre riesgo de inyección. El borrado va por SQL directo porque los
  // deleteMany de Prisma con filtros de relación no respetan las FKs Restrict
  // hacia Branch/User en el pooler, y una $transaction interactiva expira a los
  // 5s en Supabase Cloud.
  const bid = branchIds.length > 0 ? branchIds.map((id) => `'${id}'`).join(",") : "''";

  const deleteSteps = [
    // ── Hijos de ventas (por sucursal) ──
    `delete from "CustomerAccountEntry" where "branchId" in (${bid}) or "customerId" in (select id from "Customer" where "businessId" = '${businessId}')`,
    `delete from "StockMovement" where "branchId" in (${bid})`,
    `delete from "StockLevel" where "branchId" in (${bid})`,
    `delete from "SaleItemModifier" where "saleItemId" in (select id from "SaleItem" where "saleId" in (select id from "Sale" where "branchId" in (${bid})))`,
    `delete from "SaleItem" where "saleId" in (select id from "Sale" where "branchId" in (${bid}))`,
    `delete from "SalePayment" where "saleId" in (select id from "Sale" where "branchId" in (${bid}))`,
    `delete from "SaleDiscount" where "saleId" in (select id from "Sale" where "branchId" in (${bid}))`,
    `delete from "SaleReturnItem" where "returnId" in (select id from "SaleReturn" where "branchId" in (${bid}))`,
    `delete from "SaleReturn" where "branchId" in (${bid})`,
    `delete from "Sale" where "branchId" in (${bid})`,
    // ── Compras y proveedores ──
    `delete from "PurchasePayment" where "purchaseId" in (select id from "Purchase" where "businessId" = '${businessId}')`,
    `delete from "PurchaseItem" where "purchaseId" in (select id from "Purchase" where "businessId" = '${businessId}')`,
    `delete from "PurchaseCredit" where "purchaseId" in (select id from "Purchase" where "businessId" = '${businessId}')`,
    `delete from "Purchase" where "businessId" = '${businessId}'`,
    `delete from "Supplier" where "businessId" = '${businessId}'`,
    // ── Caja y cuentas ──
    `delete from "Expense" where "businessId" = '${businessId}'`,
    `delete from "CashCloseLine" where "closeId" in (select id from "CashClose" where "businessId" = '${businessId}')`,
    `delete from "CashClose" where "businessId" = '${businessId}'`,
    `delete from "AccountTransfer" where "businessId" = '${businessId}'`,
    `delete from "AccountOpeningBalance" where "businessId" = '${businessId}'`,
    `delete from "LoyaltyEntry" where "businessId" = '${businessId}'`,
    `delete from "Customer" where "businessId" = '${businessId}'`,
    // ── Productos, precios y terminales ──
    `delete from "BranchProductPrice" where "branchId" in (${bid})`,
    `delete from "Terminal" where "branchId" in (${bid})`,
    `delete from "ProductImage" where "productId" in (select id from "Product" where "businessId" = '${businessId}')`,
    `delete from "AiImageDailyUsage" where "businessId" = '${businessId}'`,
    `delete from "RecipeItem" where "productId" in (select id from "Product" where "businessId" = '${businessId}')`,
    `delete from "Production" where "businessId" = '${businessId}'`,
    `delete from "Waste" where "businessId" = '${businessId}'`,
    `delete from "Product" where "businessId" = '${businessId}'`,
    `delete from "ProductFamily" where "businessId" = '${businessId}'`,
    `delete from "ProductCategory" where "businessId" = '${businessId}'`,
    `delete from "BusinessModuleAccess" where "businessId" = '${businessId}'`,
    // ── Mesas, órdenes y cocina ──
    `delete from "OrderItemModifier" where "orderItemId" in (select id from "OrderItem" where "orderId" in (select id from "Order" where "businessId" = '${businessId}'))`,
    `delete from "OrderItem" where "orderId" in (select id from "Order" where "businessId" = '${businessId}')`,
    `delete from "Order" where "businessId" = '${businessId}'`,
    `delete from "Table" where "businessId" = '${businessId}'`,
    `delete from "Sector" where "businessId" = '${businessId}'`,
    // ── Presupuestos y turnos ──
    `delete from "QuoteItem" where "quoteId" in (select id from "Quote" where "businessId" = '${businessId}')`,
    `delete from "Quote" where "businessId" = '${businessId}'`,
    `delete from "Appointment" where "businessId" = '${businessId}'`,
    `delete from "AppLog" where "businessId" = '${businessId}'`,
    // ── Modificadores ──
    `delete from "Modifier" where "businessId" = '${businessId}'`,
    `delete from "ModifierGroup" where "businessId" = '${businessId}'`,
    // ── Identidad y tronco ──
    `delete from "AuthProvisionAttempt" where "jobId" in (select id from "AuthProvisionJob" where "userId" in (select id from "User" where "businessId" = '${businessId}'))`,
    `delete from "AuthProvisionJob" where "userId" in (select id from "User" where "businessId" = '${businessId}')`,
    `delete from "User" where "businessId" = '${businessId}'`,
    `delete from "Branch" where "businessId" = '${businessId}'`,
    `delete from "Business" where id = '${businessId}'`,
  ];

  for (const sql of deleteSteps) {
    await prisma.$executeRawUnsafe(sql);
  }
}

async function main() {
  // El borrado va scoped al tenant demo (ver DEMO_BUSINESS_PUBLIC_TOKEN). En una
  // base compartida de Cloud no se toca el resto de los negocios.
  await deleteDemoTenant();

  const business = await prisma.business.create({
    data: {
      name: "Kiosco El Rulo",
      vertical: Vertical.KIOSK,
      // Marketing listo para mirar: página pública prendida, link de reseñas y
      // el programa de puntos configurado ($1.000 = 1 punto, cada punto $50).
      publicToken: "demo-kiosco-el-rulo",
      publicPageActive: true,
      publicNote: "Lun a sáb de 8 a 22. Av. Siempreviva 742.",
      googleReviewUrl: "https://g.page/r/demo-kiosco-el-rulo/review",
      pointsPerAmount: 1_000,
      pointValue: 50,
    },
  });

  // Todos los módulos prendidos: la demo tiene que mostrar el sistema entero.
  await prisma.businessModuleAccess.createMany({
    data: Object.values(AppModule).map((module) => ({ businessId: business.id, module })),
  });

  const branches = await Promise.all(
    branchSeeds.map((branch) =>
      prisma.branch.create({
        data: { businessId: business.id, name: branch.name, address: branch.address, active: true },
      }),
    ),
  );

  const branchByName = new Map(branches.map((branch) => [branch.name, branch]));

  // El dueño de este negocio demo NO atiende: es un kiosco con tres sucursales
  // y sus propios empleados, así que se queda sin `sellsAsId`. Atarlo a alguno
  // sería un dato falso —diría que Matías vende como Nico— y este seed también
  // se usa para mirar la app.
  const ownerId = randomUUID();
  const authOwner = await createDemoAuthUser({ businessId: business.id, userId: ownerId });
  await prisma.user.create({
    data: {
      id: ownerId,
      businessId: business.id,
      branchId: branches[0].id,
      name: "Matías Toledo",
      email: DEMO_OWNER_EMAIL,
      authUserId: authOwner.id,
      authEmailCanonical: DEMO_OWNER_EMAIL,
      emailOwnershipStatus: EmailOwnershipStatus.UNVERIFIED_AUTOCONFIRM,
      authLinkedAt: new Date(),
      role: UserRole.OWNER,
    },
  });

  const staffs = await Promise.all(
    staffSeeds.map(async (staff) => {
      const branch = branchByName.get(staff.branchName);

      if (!branch) {
        throw new Error(`Falta la sucursal del empleado: ${staff.branchName}`);
      }

      return prisma.user.create({
        data: {
          businessId: business.id,
          branchId: branch.id,
          name: staff.name,
          pinHash: await bcrypt.hash(staff.pin, 12),
          role: UserRole.STAFF,
          active: true,
          commissionRate: 10,
        },
      });
    }),
  );

  // Una terminal (caja) por empleado, en su sucursal.
  const terminals = await Promise.all(
    staffs.map((staff) =>
      prisma.terminal.create({
        data: {
          branchId: staff.branchId as string,
          staffId: staff.id,
          name: `Terminal ${staff.name.split(" ")[0]}`,
          active: true,
        },
      }),
    ),
  );

  const terminalByStaffId = new Map(terminals.map((terminal) => [terminal.staffId as string, terminal]));

  const categories = await Promise.all(
    categorySeeds.map((name) => prisma.productCategory.create({ data: { businessId: business.id, name } })),
  );
  const categoryByName = new Map(categories.map((category) => [category.name, category]));

  const products = await Promise.all(
    productSeeds.map((seed) =>
      prisma.product.create({
        data: {
          businessId: business.id,
          categoryId: categoryByName.get(seed.category)?.id ?? null,
          name: seed.name,
          kind: seed.kind ?? ProductKind.GOOD,
          unit: seed.unit ?? Unit.UNIT,
          barcode: seed.barcode ?? null,
          cost: seed.cost ?? null,
          trackStock: (seed.kind ?? ProductKind.GOOD) === ProductKind.GOOD,
          minStock: seed.minStock ? seed.minStock * ONE : null,
          packSize: seed.packSize ?? null,
          packLabel: seed.packLabel ?? null,
          active: true,
        },
      }),
    ),
  );

  const priceByBranchAndProduct = new Map<string, number>();

  await Promise.all(
    branches.flatMap((branch) =>
      products.map((product, index) => {
        const seed = productSeeds[index];
        const price = roundToNearestHundred(seed.price * (branchPriceMultipliers[branch.name] ?? 1));
        priceByBranchAndProduct.set(`${branch.id}:${product.id}`, price);

        return prisma.branchProductPrice.create({
          data: { branchId: branch.id, productId: product.id, price, active: true },
        });
      }),
    ),
  );

  const now = new Date();

  // Carga inicial de inventario: el asiento y el saldo van siempre juntos.
  const stock = new Map<string, number>();

  for (const branch of branches) {
    for (const [index, product] of products.entries()) {
      const seed = productSeeds[index];

      if (!seed.stock) continue;

      const quantity = seed.stock * ONE;
      stock.set(`${branch.id}:${product.id}`, quantity);

      await prisma.stockMovement.create({
        data: {
          branchId: branch.id,
          productId: product.id,
          type: StockMovementType.INITIAL,
          quantity,
          unitCost: seed.cost ?? null,
          reason: "Carga inicial de inventario",
          occurredAt: buildDaysBackDate(now, SEED_DAYS, 9),
        },
      });

      await prisma.stockLevel.create({
        data: { branchId: branch.id, productId: product.id, quantity },
      });
    }
  }

  // ── Clientes con cuenta corriente ─────────────────────────────────────────
  const customerSeeds = [
    // `birthdayMonthOffset` es relativo al mes de la corrida: así siempre hay
    // alguien cumpliendo este mes para poder ver la pantalla de marketing.
    { name: "Rodrigo Pérez", phone: "11 5555-1111", creditLimit: 30_000, debt: 12_500, birthdayMonthOffset: 0, birthdayDay: 12 },
    { name: "Carla Suárez", phone: "11 5555-2222", creditLimit: 20_000, debt: 0, birthdayMonthOffset: 0, birthdayDay: 24 },
    { name: "Kiosco de la esquina", phone: "11 5555-3333", creditLimit: 50_000, debt: 47_000, birthdayMonthOffset: 2, birthdayDay: 5 },
    { name: "Julián Ferreyra", phone: "11 5555-4444", creditLimit: null, debt: 3200, birthdayMonthOffset: null, birthdayDay: 1 },
  ];

  const customers: { id: string; name: string }[] = [];

  for (const seed of customerSeeds) {
    const customer = await prisma.customer.create({
      data: {
        businessId: business.id,
        name: seed.name,
        phone: seed.phone,
        creditLimit: seed.creditLimit,
        birthday:
          seed.birthdayMonthOffset === null
            ? null
            : new Date(1990, now.getMonth() + seed.birthdayMonthOffset, seed.birthdayDay),
        active: true,
      },
    });

    customers.push(customer);

    if (seed.debt > 0) {
      await prisma.customerAccountEntry.create({
        data: {
          customerId: customer.id,
          branchId: branches[0].id,
          type: CustomerAccountEntryType.CHARGE,
          amount: seed.debt,
          note: "Saldo anterior",
          occurredAt: buildDaysBackDate(now, SEED_DAYS - 2, 11),
        },
      });
    }
  }

  // "Kiosco de la esquina" queda fuera de las ventas recientes: es el cliente
  // que se está yendo, el que la pantalla de marketing tiene que encontrar.
  const lapsedCustomer = customers[2];
  const recentCustomers = customers.filter((customer) => customer.id !== lapsedCustomer.id);

  // ── Proveedores y cuentas a pagar ─────────────────────────────────────────
  const suppliers = await Promise.all(
    [
      { name: "Distribuidora del Centro", taxId: "30712345678", phone: "11 4444-1111" },
      { name: "Mayorista Sur", taxId: "30798765432", phone: "11 4444-2222" },
      { name: "Lácteos San Juan", taxId: "30711223344", phone: "11 4444-3333" },
    ].map((seed) =>
      prisma.supplier.create({
        data: { businessId: business.id, name: seed.name, taxId: seed.taxId, phone: seed.phone, active: true },
      }),
    ),
  );

  // Una vencida, una por vencer y una saldada: cubre los tres estados que la
  // pantalla de proveedores tiene que saber distinguir.
  const purchaseSeeds = [
    { supplier: suppliers[0], daysAgo: 20, dueInDays: -5, total: 185_000, paid: 0, status: PurchaseStatus.PENDING },
    { supplier: suppliers[1], daysAgo: 6, dueInDays: 3, total: 240_000, paid: 90_000, status: PurchaseStatus.PARTIAL },
    { supplier: suppliers[2], daysAgo: 12, dueInDays: -2, total: 96_000, paid: 96_000, status: PurchaseStatus.PAID },
  ];

  for (const [index, seed] of purchaseSeeds.entries()) {
    const issuedAt = buildDaysBackDate(now, seed.daysAgo, 10);
    const dueAt = new Date(now);
    dueAt.setDate(now.getDate() + seed.dueInDays);
    dueAt.setHours(0, 0, 0, 0);

    const purchase = await prisma.purchase.create({
      data: {
        businessId: business.id,
        branchId: branches[0].id,
        supplierId: seed.supplier.id,
        number: `0001-0000${1000 + index}`,
        total: seed.total,
        status: seed.status,
        issuedAt,
        dueAt,
        items: {
          create: [
            {
              productId: products[index].id,
              description: products[index].name,
              quantity: 50 * ONE,
              unit: Unit.UNIT,
              unitCost: Math.round(seed.total / 50),
              total: seed.total,
            },
          ],
        },
      },
    });

    if (seed.paid > 0) {
      await prisma.purchasePayment.create({
        data: {
          purchaseId: purchase.id,
          amount: seed.paid,
          method: PaymentMethod.TRANSFER,
          paidAt: buildDaysBackDate(now, Math.max(seed.daysAgo - 2, 0), 12),
        },
      });
    }
  }

  // ── Promociones ───────────────────────────────────────────────────────────
  const golosinas = categoryByName.get("Golosinas");

  if (golosinas) {
    const promo = await prisma.promotion.create({
      data: {
        businessId: business.id,
        name: "3x2 en golosinas",
        type: PromotionType.NX_M,
        scope: PromotionScope.CATEGORY,
        buyQuantity: 3,
        payQuantity: 2,
        priority: 10,
        active: true,
      },
    });

    await prisma.promotionTarget.create({ data: { promotionId: promo.id, categoryId: golosinas.id } });
  }

  await prisma.promotion.create({
    data: {
      businessId: business.id,
      name: "Miércoles de 10% off",
      type: PromotionType.PERCENT_OFF,
      scope: PromotionScope.ALL,
      percentOff: 10,
      // ISO: 3 = miércoles.
      weekdays: "3",
      minAmount: 10_000,
      priority: 1,
      active: true,
    },
  });

  // ── Ventas ────────────────────────────────────────────────────────────────
  const staffByBranchId = new Map<string, typeof staffs>();
  for (const staff of staffs) {
    const list = staffByBranchId.get(staff.branchId as string) ?? [];
    list.push(staff);
    staffByBranchId.set(staff.branchId as string, list);
  }

  const paymentMethods = [
    PaymentMethod.CASH,
    PaymentMethod.CASH,
    PaymentMethod.DEBIT_CARD,
    PaymentMethod.MERCADO_PAGO,
    PaymentMethod.TRANSFER,
    PaymentMethod.QR,
  ];

  for (let index = 0; index < SALE_COUNT; index += 1) {
    const branch = branches[index % branches.length];
    const branchStaffs = staffByBranchId.get(branch.id) ?? [];
    const staff = branchStaffs[index % branchStaffs.length];
    const soldAt = buildSaleDate(now, index);
    // Una de cada seis ventas queda a nombre de un cliente: es lo que alimenta
    // "clientes que no vuelven", "mejores clientes" y los puntos.
    const saleCustomer = index % 6 === 0 ? recentCustomers[(index / 6) % recentCustomers.length] : null;

    // Uno o dos renglones por venta; el segundo aparece en dos de cada tres.
    const pickIndexes = [index % products.length];
    if (index % 3 !== 0) {
      pickIndexes.push((index * 5 + 3) % products.length);
    }

    const items = pickIndexes.map((productIndex, pickIndex) => {
      const product = products[productIndex];
      const seed = productSeeds[productIndex];
      const unitPrice = priceByBranchAndProduct.get(`${branch.id}:${product.id}`) ?? seed.price;
      // Lo que se vende por peso va en fracciones; el resto, de a una o dos.
      const quantity =
        seed.unit === Unit.KG
          ? [250, 500, 750, 1000][(index + pickIndex) % 4]
          : ((index + pickIndex) % 2 === 0 ? 1 : 2) * ONE;

      return {
        product,
        seed,
        quantity,
        unitPrice,
        total: Math.round((unitPrice * quantity) / ONE),
      };
    });

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const method = paymentMethods[index % paymentMethods.length];

    const sale = await prisma.sale.create({
      data: {
        branchId: branch.id,
        staffId: staff.id,
        terminalId: terminalByStaffId.get(staff.id)?.id ?? null,
        customerId: saleCustomer?.id ?? null,
        subtotal,
        discountTotal: 0,
        total: subtotal,
        soldAt,
        items: {
          create: items.map((item) => ({
            productId: item.product.id,
            description: item.product.name,
            quantity: item.quantity,
            unit: item.seed.unit ?? Unit.UNIT,
            unitPrice: item.unitPrice,
            unitCost: item.seed.cost ?? null,
            total: item.total,
          })),
        },
        payments: { create: [{ method, amount: subtotal }] },
        // Puntos del programa de fidelidad ($1.000 = 1 punto), para que la
        // pantalla de marketing tenga saldos reales que mostrar.
        ...(saleCustomer
          ? {
              loyaltyEntries: {
                create: [
                  {
                    businessId: business.id,
                    customerId: saleCustomer.id,
                    points: Math.floor(subtotal / 1_000),
                  },
                ],
              },
            }
          : {}),
      },
    });

    // La salida de stock acompaña a la venta, igual que en la app real.
    for (const item of items) {
      const key = `${branch.id}:${item.product.id}`;
      const current = stock.get(key);

      if (current === undefined) continue;

      stock.set(key, current - item.quantity);

      await prisma.stockMovement.create({
        data: {
          branchId: branch.id,
          productId: item.product.id,
          type: StockMovementType.SALE,
          quantity: -item.quantity,
          unitCost: item.seed.cost ?? null,
          saleId: sale.id,
          occurredAt: soldAt,
        },
      });
    }
  }

  // La compra vieja del cliente que se está yendo (70 días atrás, fuera del
  // rango sembrado): es lo que hace que aparezca en "clientes que no vuelven".
  {
    const branch = branches[0];
    const staff = (staffByBranchId.get(branch.id) ?? [])[0];
    const product = products[0];
    const price = priceByBranchAndProduct.get(`${branch.id}:${product.id}`) ?? 1800;
    const soldAt = buildDaysBackDate(now, 70, 17);

    await prisma.sale.create({
      data: {
        branchId: branch.id,
        staffId: staff.id,
        customerId: lapsedCustomer.id,
        subtotal: price * 3,
        discountTotal: 0,
        total: price * 3,
        soldAt,
        items: {
          create: [
            {
              productId: product.id,
              description: product.name,
              quantity: 3 * ONE,
              unit: Unit.UNIT,
              unitPrice: price,
              total: price * 3,
              createdAt: soldAt,
            },
          ],
        },
        payments: { create: [{ method: PaymentMethod.CASH, amount: price * 3 }] },
        loyaltyEntries: {
          create: [
            {
              businessId: business.id,
              customerId: lapsedCustomer.id,
              points: Math.floor((price * 3) / 1_000),
              createdAt: soldAt,
            },
          ],
        },
      },
    });
  }

  // Los saldos quedan alineados con el libro de movimientos.
  for (const [key, quantity] of stock) {
    const [branchId, productId] = key.split(":");
    await prisma.stockLevel.update({
      where: { branchId_productId: { branchId, productId } },
      data: { quantity },
    });
  }

  // ── Gastos ────────────────────────────────────────────────────────────────
  const expenseSeeds = [
    { category: ExpenseCategory.RENT, amount: 450_000, note: "Alquiler del local", daysBack: 12 },
    { category: ExpenseCategory.SALARIES, amount: 780_000, note: "Sueldos quincena", daysBack: 8 },
    { category: ExpenseCategory.MERCHANDISE, amount: 320_000, note: "Reposición mayorista", daysBack: 5 },
    { category: ExpenseCategory.UTILITIES, amount: 96_000, note: "Luz y gas", daysBack: 3 },
    { category: ExpenseCategory.SUPPLIES, amount: 45_000, note: "Bolsas y tickets", daysBack: 1 },
  ];

  await Promise.all(
    expenseSeeds.map((expense, index) =>
      prisma.expense.create({
        data: {
          businessId: business.id,
          branchId: branches[index % branches.length].id,
          category: expense.category,
          paymentMethod: index % 2 === 0 ? PaymentMethod.CASH : PaymentMethod.TRANSFER,
          amount: expense.amount,
          note: expense.note,
          spentAt: buildDaysBackDate(now, expense.daysBack, 15),
        },
      }),
    ),
  );

  // Saldos de apertura, para que el arqueo no arranque en cero.
  await Promise.all(
    [PaymentMethod.CASH, PaymentMethod.MERCADO_PAGO].map((method) =>
      prisma.accountOpeningBalance.create({
        data: {
          businessId: business.id,
          branchId: null,
          paymentMethod: method,
          amount: method === PaymentMethod.CASH ? 150_000 : 80_000,
        },
      }),
    ),
  );
}

// Reparte las ventas entre los días del rango. index*7 con 15 días es coprimo,
// así que visita todos los días.
function buildSaleDate(now: Date, index: number) {
  const daysBack = (index * 7) % SEED_DAYS;
  const date = new Date(now);
  date.setDate(now.getDate() - daysBack);
  date.setHours(9 + (index % 12), (index * 13) % 60, 0, 0);

  return notInTheFuture(date, now, index);
}

function buildDaysBackDate(now: Date, daysBack: number, hour: number) {
  const date = new Date(now);
  date.setDate(now.getDate() - daysBack);
  date.setHours(hour, 0, 0, 0);

  return notInTheFuture(date, now, daysBack);
}

// Las horas de "hoy" (9 a 20) caen adelante si el seed corre a la mañana, y una
// venta futura encabeza el historial para siempre: la que se acaba de cobrar
// queda sepultada. Se retrocede lo justo para que el orden sea el real.
function notInTheFuture(date: Date, now: Date, offsetIndex: number) {
  if (date <= now) {
    return date;
  }

  return new Date(now.getTime() - (offsetIndex + 1) * 60_000);
}

function roundToNearestHundred(value: number) {
  return Math.round(value / 100) * 100;
}

main()
  .then(async () => {
    console.log(`Seed completo para Kiosco El Rulo (${SEED_DAYS} días de datos).`);
    console.log("Admin: owner@bills.local / admin123");
    console.log("PINs de empleados demo:");
    for (const staff of staffSeeds) {
      console.log(`- ${staff.name}: ${staff.pin}`);
    }
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
