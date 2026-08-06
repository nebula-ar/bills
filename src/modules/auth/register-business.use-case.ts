import { hash } from "bcryptjs";

import { AuthProvisionKind, AuthProvisionStatus, UserRole, Vertical } from "@/generated/prisma/client";
import { logEvent } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { verticalPreset } from "@/lib/vertical";

export type RegisterStaffInput = { name: string; pin: string };
export type RegisterBranchInput = { name: string; address?: string; staffs: RegisterStaffInput[] };
export type RegisterBusinessInput = {
  businessName: string;
  // Rubro elegido en el onboarding. Define qué módulos vienen prendidos y con
  // qué catálogo arranca el negocio (ver src/lib/vertical.ts).
  vertical?: Vertical;
  ownerName: string;
  email: string;
  username?: string;
  password: string;
  branches: RegisterBranchInput[];
  // "Yo atiendo" del onboarding. En un comercio chico el dueño es DOS filas:
  // con la que entra (OWNER, sin sucursal) y con la que vende (STAFF, con
  // sucursal), porque `Sale.staffId` exige un STAFF de la sucursal. Esta bandera
  // es lo único que las ata (`sellsAsId`); sin el lazo son dos personas
  // distintas para el sistema y la app no puede saber que la venta es suya.
  ownerSells?: boolean;
};

export type RegisterResult = { ok: true; userId: string; emailCanonical: string } | { ok: false; error: string };

const PIN_RE = /^\d{4,8}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9._-]{3,20}$/;

// Chequeo temprano (paso del email) para no hacer completar todo el onboarding
// y recién ahí avisar que el email está en uso. En el submit se revalida igual.
export async function isEmailAvailable(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_RE.test(normalized)) return false;
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: normalized }, { authEmailCanonical: normalized }] },
    select: { id: true },
  });
  return !existing;
}

export async function registerBusiness(input: RegisterBusinessInput): Promise<RegisterResult> {
  const businessName = input.businessName.trim();
  const ownerName = input.ownerName.trim();
  const email = input.email.trim().toLowerCase();
  const username = (input.username ?? "").trim().toLowerCase();
  const password = input.password ?? "";

  if (!businessName) return { ok: false, error: "Poné el nombre de tu negocio." };
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
      staffs: branch.staffs
        .map((staff) => ({ name: staff.name.trim(), pin: staff.pin.trim() }))
        .filter((staff) => staff.name.length > 0),
    }))
    .filter((branch) => branch.name.length > 0);

  if (branches.length === 0) return { ok: false, error: "Agregá al menos una sucursal." };

  // El PIN es opcional: si lo cargan tiene que ser de 4 a 8 números; si no, el
  // empleado queda sin PIN (se le puede poner después desde Empleados).
  for (const branch of branches) {
    for (const staff of branch.staffs) {
      if (staff.pin && !PIN_RE.test(staff.pin)) {
        return { ok: false, error: `El PIN de ${staff.name} tiene que ser de 4 a 8 números.` };
      }
    }
  }

  const existingEmail = await prisma.user.findFirst({
    where: { OR: [{ email }, { authEmailCanonical: email }] },
  });
  if (existingEmail) {
    return { ok: false, error: "Ya hay una cuenta con ese email." };
  }

  if (username) {
    const existingUsername = await prisma.user.findFirst({ where: { username } });
    if (existingUsername) {
      return { ok: false, error: "Ese nombre de usuario ya está en uso." };
    }
  }

  const branchesWithHashes = await Promise.all(
    branches.map(async (branch) => ({
      name: branch.name,
      address: branch.address,
      staffs: await Promise.all(
        branch.staffs.map(async (staff) => ({
          name: staff.name,
          pinHash: staff.pin ? await hash(staff.pin, 12) : null,
        })),
      ),
    })),
  );

  const vertical = input.vertical ?? Vertical.GENERAL;
  const preset = verticalPreset(vertical);

  const registration = await prisma.$transaction(async (tx) => {
    const business = await tx.business.create({ data: { name: businessName, vertical } });

    // Módulos del rubro: el negocio arranca viendo solo lo que necesita.
    await tx.businessModuleAccess.createMany({
      data: preset.modules.map((module) => ({ businessId: business.id, module })),
    });

    const owner = await tx.user.create({
      data: {
        businessId: business.id,
        name: ownerName,
        email,
        username: username || null,
        role: UserRole.OWNER,
        active: true,
      },
    });

    await tx.authProvisionJob.create({
      data: {
        kind: AuthProvisionKind.REGISTRATION,
        status: AuthProvisionStatus.READY,
        userId: owner.id,
        emailCanonical: email,
      },
    });

    // El primer empleado creado. Con "Yo atiendo" ese empleado ES el dueño (el
    // wizard lo carga con su propio nombre), y es con el que va a vender.
    let firstStaffId: string | null = null;

    for (const branch of branchesWithHashes) {
      const createdBranch = await tx.branch.create({
        data: { businessId: business.id, name: branch.name, address: branch.address, active: true },
      });

      for (const staff of branch.staffs) {
        const createdStaff = await tx.user.create({
          data: {
            businessId: business.id,
            branchId: createdBranch.id,
            name: staff.name,
            pinHash: staff.pinHash,
            role: UserRole.STAFF,
            active: true,
          },
        });

        firstStaffId ??= createdStaff.id;
      }
    }

    // Acá se ata la fila con la que entra a la fila con la que vende. Va dentro
    // de la misma transacción que las dos: un dueño creado a medias —que entra
    // pero no puede cobrar— no es un alta válida.
    if (input.ownerSells && firstStaffId) {
      await tx.user.update({ where: { id: owner.id }, data: { sellsAsId: firstStaffId } });
    }

    // Categorías del rubro: el catálogo todavía está vacío, pero cuando el
    // dueño lo cargue desde la app ya tiene dónde ordenar cada cosa.
    for (const name of preset.categories) {
      await tx.productCategory.create({ data: { businessId: business.id, name } });
    }

    return { businessId: business.id, userId: owner.id };
  });

  await logEvent("business.register", `Alta de negocio "${businessName}"`, {
    businessId: registration.businessId,
    context: {
      businessName,
      branches: branchesWithHashes.length,
      staffs: branchesWithHashes.reduce((sum, branch) => sum + branch.staffs.length, 0),
    },
  });

  return { ok: true, userId: registration.userId, emailCanonical: email };
}
