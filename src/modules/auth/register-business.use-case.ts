import { hash } from "bcryptjs";

import { UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type RegisterBarberInput = { name: string; pin: string };
export type RegisterBranchInput = { name: string; address?: string; barbers: RegisterBarberInput[] };
export type RegisterServiceInput = { name: string; price: number };
export type RegisterBusinessInput = {
  businessName: string;
  ownerName: string;
  email: string;
  username?: string;
  password: string;
  branches: RegisterBranchInput[];
  services?: RegisterServiceInput[];
};

export type RegisterResult = { ok: true } | { ok: false; error: string };

const PIN_RE = /^\d{4,8}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9._-]{3,20}$/;

export async function registerBusiness(input: RegisterBusinessInput): Promise<RegisterResult> {
  const businessName = input.businessName.trim();
  const ownerName = input.ownerName.trim();
  const email = input.email.trim().toLowerCase();
  const username = (input.username ?? "").trim().toLowerCase();
  const password = input.password ?? "";

  if (!businessName) return { ok: false, error: "Poné el nombre de la barbería." };
  if (!ownerName) return { ok: false, error: "Poné tu nombre." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "El email no es válido." };
  if (username && !USERNAME_RE.test(username)) {
    return { ok: false, error: "El usuario tiene que tener 3 a 20 caracteres (letras, números, . _ -)." };
  }
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

  // Servicios (opcionales): se crean en la primera sucursal con su precio. Se
  // descartan los vacíos o con precio inválido y se evita repetir por nombre.
  const seenServiceNames = new Set<string>();
  const services = (input.services ?? [])
    .map((service) => ({ name: service.name.trim(), price: Math.round(service.price) }))
    .filter((service) => {
      if (service.name.length === 0 || !Number.isInteger(service.price) || service.price <= 0) return false;
      const key = service.name.toLowerCase();
      if (seenServiceNames.has(key)) return false;
      seenServiceNames.add(key);
      return true;
    });

  // El PIN es opcional: si lo cargan tiene que ser de 4 a 8 números; si no, el
  // barbero queda sin PIN (se le puede poner después desde Barberos).
  for (const branch of branches) {
    for (const barber of branch.barbers) {
      if (barber.pin && !PIN_RE.test(barber.pin)) {
        return { ok: false, error: `El PIN de ${barber.name} tiene que ser de 4 a 8 números.` };
      }
    }
  }

  const existingEmail = await prisma.user.findFirst({ where: { email, deleted: false } });
  if (existingEmail) {
    return { ok: false, error: "Ya hay una cuenta con ese email." };
  }

  if (username) {
    const existingUsername = await prisma.user.findFirst({ where: { username } });
    if (existingUsername) {
      return { ok: false, error: "Ese nombre de usuario ya está en uso." };
    }
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
        username: username || null,
        passwordHash,
        role: UserRole.OWNER,
        active: true,
      },
    });

    let firstBranchId: string | null = null;
    for (const [index, branch] of branchesWithHashes.entries()) {
      const createdBranch = await tx.branch.create({
        data: { businessId: business.id, name: branch.name, address: branch.address, active: true },
      });
      if (index === 0) firstBranchId = createdBranch.id;

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

    // Catálogo inicial: cada servicio con su precio en la primera sucursal.
    if (firstBranchId) {
      for (const service of services) {
        const createdService = await tx.service.create({
          data: { businessId: business.id, name: service.name, active: true },
        });
        await tx.branchServicePrice.create({
          data: { branchId: firstBranchId, serviceId: createdService.id, price: service.price, active: true },
        });
      }
    }
  });

  return { ok: true };
}
