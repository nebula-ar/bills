import bcrypt from "bcryptjs";

import {
  ExpenseCategory,
  PaymentMethod,
  SaleStatus,
  UserRole,
} from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";

// Cantidad de días hacia atrás (incluye hoy) que cubre la data de demo.
const SEED_DAYS = 15;
// Cantidad total de ventas a repartir en esos días (~12 por día).
const SALE_COUNT = 180;

type BranchSeed = {
  name: string;
  address: string;
};

type BarberSeed = {
  name: string;
  branchName: string;
  pin: string;
};

type ServiceSeed = {
  name: string;
  description: string;
  basePrice: number;
};

const branchSeeds: BranchSeed[] = [
  {
    name: "Sucursal Centro",
    address: "Av. Corrientes 1234, CABA",
  },
  {
    name: "Sucursal Palermo",
    address: "Gorriti 4567, CABA",
  },
  {
    name: "Sucursal Norte",
    address: "Av. Maipú 890, Vicente López",
  },
];

const barberSeeds: BarberSeed[] = [
  { name: "Nico Fernández", branchName: "Sucursal Centro", pin: "1111" },
  { name: "Lucas Gómez", branchName: "Sucursal Centro", pin: "2222" },
  { name: "Fede González", branchName: "Sucursal Palermo", pin: "3333" },
  { name: "Matías Ruiz", branchName: "Sucursal Palermo", pin: "4444" },
  { name: "Franco Díaz", branchName: "Sucursal Norte", pin: "5555" },
  { name: "Nahuel Silva", branchName: "Sucursal Norte", pin: "6666" },
];

const serviceSeeds: ServiceSeed[] = [
  {
    name: "Corte clásico",
    description: "Corte tradicional con terminación a máquina.",
    basePrice: 9000,
  },
  {
    name: "Perfilado de barba",
    description: "Perfilado y arreglo de barba.",
    basePrice: 6500,
  },
  {
    name: "Corte y barba",
    description: "Combo de corte clásico y barba.",
    basePrice: 14500,
  },
  {
    name: "Lavado",
    description: "Lavado con shampoo y secado rápido.",
    basePrice: 4500,
  },
  {
    name: "Cejas",
    description: "Perfilado de cejas.",
    basePrice: 3500,
  },
  {
    name: "Color express",
    description: "Servicio rápido de color y retoque.",
    basePrice: 18000,
  },
];

const branchPriceMultipliers: Record<string, number> = {
  "Sucursal Centro": 1,
  "Sucursal Palermo": 1.15,
  "Sucursal Norte": 0.95,
};

async function main() {
  // Orden de borrado respetando las FKs (hijos antes que padres).
  await prisma.salePayment.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.branchServicePrice.deleteMany();
  await prisma.terminal.deleteMany();
  await prisma.service.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.business.deleteMany();

  const business = await prisma.business.create({
    data: {
      name: "Barbería El Rulo",
    },
  });

  const branches = await Promise.all(
    branchSeeds.map((branch) =>
      prisma.branch.create({
        data: {
          businessId: business.id,
          name: branch.name,
          address: branch.address,
          active: true,
        },
      }),
    ),
  );

  const branchByName = new Map(branches.map((branch) => [branch.name, branch]));

  await prisma.user.create({
    data: {
      businessId: business.id,
      branchId: branches[0].id,
      name: "Matías Toledo",
      email: "owner@barber-bills.local",
      passwordHash: await bcrypt.hash("admin123", 12),
      role: UserRole.OWNER,
    },
  });

  const barbers = await Promise.all(
    barberSeeds.map(async (barber) => {
      const branch = branchByName.get(barber.branchName);

      if (!branch) {
        throw new Error(`Missing branch for barber seed: ${barber.branchName}`);
      }

      return prisma.user.create({
        data: {
          businessId: business.id,
          branchId: branch.id,
          name: barber.name,
          pinHash: await bcrypt.hash(barber.pin, 12),
          role: UserRole.BARBER,
          active: true,
        },
      });
    }),
  );

  // Una terminal (caja) por barbero, en su sucursal. Cubre el flujo de la
  // terminal del barbero y permite atribuir cada venta a una terminal.
  const terminals = await Promise.all(
    barbers.map((barber) =>
      prisma.terminal.create({
        data: {
          branchId: barber.branchId as string,
          barberId: barber.id,
          name: `Terminal ${barber.name.split(" ")[0]}`,
          active: true,
        },
      }),
    ),
  );

  const terminalByBarberId = new Map(
    terminals.map((terminal) => [terminal.barberId as string, terminal]),
  );

  const services = await Promise.all(
    serviceSeeds.map((service) =>
      prisma.service.create({
        data: {
          businessId: business.id,
          name: service.name,
          description: service.description,
          active: true,
        },
      }),
    ),
  );

  const branchServicePrices = await Promise.all(
    branches.flatMap((branch) =>
      services.map((service, serviceIndex) => {
        const seed = serviceSeeds[serviceIndex];
        const multiplier = branchPriceMultipliers[branch.name] ?? 1;

        return prisma.branchServicePrice.create({
          data: {
            branchId: branch.id,
            serviceId: service.id,
            price: roundToNearestHundred(seed.basePrice * multiplier),
            active: true,
          },
        });
      }),
    ),
  );

  const servicePriceByBranchAndService = new Map(
    branchServicePrices.map((servicePrice) => [
      `${servicePrice.branchId}:${servicePrice.serviceId}`,
      servicePrice,
    ]),
  );

  await createSales({
    branches,
    barbers,
    services,
    servicePriceByBranchAndService,
    terminalByBarberId,
  });

  await createExpenses({ business, branches });
}

async function createSales(input: {
  branches: Array<{ id: string; name: string }>;
  barbers: Array<{ id: string; name: string; branchId: string | null }>;
  services: Array<{ id: string; name: string }>;
  servicePriceByBranchAndService: Map<string, { id: string; price: number }>;
  terminalByBarberId: Map<string, { id: string }>;
}) {
  const now = new Date();

  for (let index = 0; index < SALE_COUNT; index += 1) {
    const branch = input.branches[index % input.branches.length];
    const branchBarbers = input.barbers.filter((barber) => barber.branchId === branch.id);
    const barber = branchBarbers[index % branchBarbers.length];
    const terminal = input.terminalByBarberId.get(barber.id);
    const soldAt = buildSaleDate(now, index);
    const selectedServices = pickServices(input.services, index);
    const status = index % 29 === 0 ? SaleStatus.CANCELLED : SaleStatus.COMPLETED;

    const items = selectedServices.map((service) => {
      const servicePrice = input.servicePriceByBranchAndService.get(`${branch.id}:${service.id}`);

      if (!servicePrice) {
        throw new Error(`Missing service price for ${branch.name} / ${service.name}`);
      }

      const quantity = index % 17 === 0 ? 2 : 1;
      const total = servicePrice.price * quantity;

      return {
        serviceId: service.id,
        description: service.name,
        quantity,
        unitPrice: servicePrice.price,
        total,
      };
    });

    const total = items.reduce((sum, item) => sum + item.total, 0);
    const payments = buildPayments(total, index);

    await prisma.sale.create({
      data: {
        branchId: branch.id,
        barberId: barber.id,
        terminalId: terminal?.id ?? null,
        total,
        status,
        soldAt,
        notes: status === SaleStatus.CANCELLED ? "Venta demo cancelada para probar reportes." : null,
        items: {
          create: items,
        },
        payments: {
          create: payments,
        },
      },
    });
  }
}

type ExpenseSeed = {
  category: ExpenseCategory;
  amount: number;
  note: string;
  // Día hacia atrás (0 = hoy) en el que se registra el gasto.
  daysBack: number;
};

// Gastos recurrentes por sucursal repartidos en la ventana de SEED_DAYS.
const branchExpenseSeeds: ExpenseSeed[] = [
  { category: ExpenseCategory.RENT, amount: 350000, note: "Alquiler del local", daysBack: 14 },
  { category: ExpenseCategory.SALARIES, amount: 480000, note: "Sueldos quincena", daysBack: 13 },
  { category: ExpenseCategory.SUPPLIES, amount: 62000, note: "Insumos (geles, hojas, toallas)", daysBack: 11 },
  { category: ExpenseCategory.UTILITIES, amount: 38000, note: "Luz y agua", daysBack: 9 },
  { category: ExpenseCategory.MARKETING, amount: 25000, note: "Campaña redes sociales", daysBack: 6 },
  { category: ExpenseCategory.SUPPLIES, amount: 41000, note: "Reposición de productos", daysBack: 4 },
  { category: ExpenseCategory.MAINTENANCE, amount: 18000, note: "Service de máquinas", daysBack: 2 },
];

async function createExpenses(input: {
  business: { id: string };
  branches: Array<{ id: string; name: string }>;
}) {
  const now = new Date();

  const data = input.branches.flatMap((branch) =>
    branchExpenseSeeds.map((expense) => ({
      businessId: input.business.id,
      branchId: branch.id,
      category: expense.category,
      amount: expense.amount,
      note: `${expense.note} — ${branch.name}`,
      spentAt: buildDaysBackDate(now, expense.daysBack, 10),
    })),
  );

  await prisma.expense.createMany({ data });
}

function pickServices<T>(services: T[], index: number) {
  const first = services[index % services.length];
  const second = services[(index + 2) % services.length];
  const third = services[(index + 4) % services.length];

  if (index % 11 === 0) {
    return [first, second, third];
  }

  if (index % 4 === 0) {
    return [first, second];
  }

  return [first];
}

function buildPayments(total: number, index: number) {
  if (index % 7 === 0) {
    const cashAmount = roundToNearestHundred(total * 0.4);

    return [
      {
        method: PaymentMethod.CASH,
        amount: cashAmount,
      },
      {
        method: PaymentMethod.TRANSFER,
        amount: total - cashAmount,
      },
    ];
  }

  const methods = [
    PaymentMethod.CASH,
    PaymentMethod.TRANSFER,
    PaymentMethod.QR,
    PaymentMethod.DEBIT_CARD,
    PaymentMethod.CREDIT_CARD,
    PaymentMethod.MERCADO_PAGO,
  ];

  return [
    {
      method: methods[index % methods.length],
      amount: total,
    },
  ];
}

function buildSaleDate(now: Date, index: number) {
  // Reparte las ventas en los últimos SEED_DAYS (incluye hoy) para poblar las
  // tendencias diarias. index*7 con 15 días es coprimo, así visita todos los días.
  const daysBack = (index * 7) % SEED_DAYS;
  const date = new Date(now);
  date.setDate(now.getDate() - daysBack);
  date.setHours(9 + (index % 12), (index * 13) % 60, 0, 0);

  return date;
}

function buildDaysBackDate(now: Date, daysBack: number, hour: number) {
  const date = new Date(now);
  date.setDate(now.getDate() - daysBack);
  date.setHours(hour, 0, 0, 0);

  return date;
}

function roundToNearestHundred(value: number) {
  return Math.round(value / 100) * 100;
}

main()
  .then(async () => {
    console.log(`Seed completo para Barbería El Rulo (${SEED_DAYS} días de datos).`);
    console.log("Admin: owner@barber-bills.local / admin123");
    console.log("PINs de barberos demo:");
    for (const barber of barberSeeds) {
      console.log(`- ${barber.name}: ${barber.pin}`);
    }
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
