import { hash } from "bcryptjs";

import { UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type RegisterBarberInput = { name: string; pin: string };
export type RegisterBranchInput = { name: string; address?: string; barbers: RegisterBarberInput[] };
export type RegisterBusinessInput = {
  businessName: string;
  ownerName: string;
  email: string;
  password: string;
  branches: RegisterBranchInput[];
};

export type RegisterResult = { ok: true } | { ok: false; error: string };

const PIN_RE = /^\d{4,8}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function registerBusiness(input: RegisterBusinessInput): Promise<RegisterResult> {
  const businessName = input.businessName.trim();
  const ownerName = input.ownerName.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password ?? "";

  if (!businessName) return { ok: false, error: "Poné el nombre de la barbería." };
  if (!ownerName) return { ok: false, error: "Poné tu nombre." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "El email no es válido." };
  if (password.length < 6) return { ok: false, error: "La contraseña debe tener al menos 6 caracteres." };

  const branches = input.branches
    .map((branch) => ({
      name: branch.name.trim(),
      address: branch.address?.trim() || undefined,
      barbers: branch.barbers
        .map((barber) => ({ name: barber.name.trim(), pin: barber.pin.trim() }))
        .filter((barber) => barber.name.length > 0),
    }))
    .filter((branch) => branch.name.length > 0);

  if (branches.length === 0) return { ok: false, error: "Agregá al menos una sucursal." };

  // El PIN es opcional: si lo cargan tiene que ser de 4 a 8 números; si no, el
  // barbero queda sin PIN (se le puede poner después desde Barberos).
  for (const branch of branches) {
    for (const barber of branch.barbers) {
      if (barber.pin && !PIN_RE.test(barber.pin)) {
        return { ok: false, error: `El PIN de ${barber.name} tiene que ser de 4 a 8 números.` };
      }
    }
  }

  const existing = await prisma.user.findFirst({ where: { email, deleted: false } });
  if (existing) {
    return { ok: false, error: "Ya hay una cuenta con ese email." };
  }

  const passwordHash = await hash(password, 12);
  const branchesWithHashes = await Promise.all(
    branches.map(async (branch) => ({
      name: branch.name,
      address: branch.address,
      barbers: await Promise.all(
        branch.barbers.map(async (barber) => ({
          name: barber.name,
          pinHash: barber.pin ? await hash(barber.pin, 12) : null,
        })),
      ),
    })),
  );

  await prisma.$transaction(async (tx) => {
    const business = await tx.business.create({ data: { name: businessName } });

    await tx.user.create({
      data: {
        businessId: business.id,
        name: ownerName,
        email,
        passwordHash,
        role: UserRole.OWNER,
        active: true,
      },
    });

    for (const branch of branchesWithHashes) {
      const createdBranch = await tx.branch.create({
        data: { businessId: business.id, name: branch.name, address: branch.address, active: true },
      });

      for (const barber of branch.barbers) {
        await tx.user.create({
          data: {
            businessId: business.id,
            branchId: createdBranch.id,
            name: barber.name,
            pinHash: barber.pinHash,
            role: UserRole.BARBER,
            active: true,
          },
        });
      }
    }
  });

  return { ok: true };
}
