import bcrypt from "bcryptjs";

import { PaymentMethod, SaleStatus, UserRole } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";

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
  await prisma.salePayment.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.branchServicePrice.deleteMany();
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

  await createQuarterSales({
    branches,
    barbers,
    services,
    servicePriceByBranchAndService,
  });
}

async function createQuarterSales(input: {
  branches: Array<{ id: string; name: string }>;
  barbers: Array<{ id: string; name: string; branchId: string | null }>;
  services: Array<{ id: string; name: string }>;
  servicePriceByBranchAndService: Map<string, { id: string; price: number }>;
}) {
  const now = new Date();
  const quarterStart = getQuarterStart(now);
  const daysInRange = Math.max(1, differenceInCalendarDays(now, quarterStart) + 1);
  const saleCount = 180;

  for (let index = 0; index < saleCount; index += 1) {
    const branch = input.branches[index % input.branches.length];
    const branchBarbers = input.barbers.filter((barber) => barber.branchId === branch.id);
    const barber = branchBarbers[index % branchBarbers.length];
    const soldAt = buildSaleDate(quarterStart, index, daysInRange);
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
  ];

  return [
    {
      method: methods[index % methods.length],
      amount: total,
    },
  ];
}

function buildSaleDate(quarterStart: Date, index: number, daysInRange: number) {
  const date = new Date(quarterStart);
  date.setDate(quarterStart.getDate() + ((index * 5) % daysInRange));
  date.setHours(9 + (index % 12), (index * 13) % 60, 0, 0);

  return date;
}

function getQuarterStart(date: Date) {
  const quarterFirstMonth = Math.floor(date.getMonth() / 3) * 3;
  return new Date(date.getFullYear(), quarterFirstMonth, 1, 0, 0, 0, 0);
}

function differenceInCalendarDays(end: Date, start: Date) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());

  return Math.floor((endUtc - startUtc) / millisecondsPerDay);
}

function roundToNearestHundred(value: number) {
  return Math.round(value / 100) * 100;
}

main()
  .then(async () => {
    console.log("Seed completed for Barbería El Rulo.");
    console.log("Admin: owner@barber-bills.local / admin123");
    console.log("Demo barber PINs:");
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
