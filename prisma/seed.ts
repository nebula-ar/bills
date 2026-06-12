import bcrypt from "bcryptjs";

import { UserRole } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";

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

  const branch = await prisma.branch.create({
    data: {
      businessId: business.id,
      name: "Sucursal Palermo",
    },
  });

  await prisma.user.create({
    data: {
      businessId: business.id,
      branchId: branch.id,
      name: "Matías Toledo",
      email: "owner@barber-bills.local",
      passwordHash: await bcrypt.hash("admin123", 12),
      role: UserRole.OWNER,
    },
  });

  await prisma.user.createMany({
    data: [
      {
        businessId: business.id,
        branchId: branch.id,
        name: "Nico Fernández",
        role: UserRole.BARBER,
      },
      {
        businessId: business.id,
        branchId: branch.id,
        name: "Fede González",
        role: UserRole.BARBER,
      },
    ],
  });

  const services = await Promise.all([
    prisma.service.create({
      data: {
        businessId: business.id,
        name: "Corte clásico",
      },
    }),
    prisma.service.create({
      data: {
        businessId: business.id,
        name: "Perfilado de barba",
      },
    }),
    prisma.service.create({
      data: {
        businessId: business.id,
        name: "Corte y barba",
      },
    }),
  ]);

  await prisma.branchServicePrice.createMany({
    data: [
      {
        branchId: branch.id,
        serviceId: services[0].id,
        price: 8000,
      },
      {
        branchId: branch.id,
        serviceId: services[1].id,
        price: 5000,
      },
      {
        branchId: branch.id,
        serviceId: services[2].id,
        price: 12000,
      },
    ],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
