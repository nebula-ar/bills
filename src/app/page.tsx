import { UserRole } from "@/generated/prisma/client";
import { getCurrentSession, isAdminRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function Home() {
  const session = await getCurrentSession();
  const canManageSales = isAdminRole(session?.user.role);
  const business = await prisma.business.findFirst({
    where: {
      deleted: false,
    },
    include: {
      branches: {
        where: {
          deleted: false,
        },
        include: {
          servicePrices: {
            where: {
              deleted: false,
              active: true,
            },
            include: {
              service: true,
            },
            orderBy: {
              service: {
                name: "asc",
              },
            },
          },
          users: {
            where: {
              deleted: false,
              active: true,
              role: UserRole.BARBER,
            },
            orderBy: {
              name: "asc",
            },
          },
        },
      },
    },
  });

  const branch = business?.branches[0];

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-50">
      <section className="mx-auto flex max-w-3xl flex-col gap-8">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-amber-400">
            Barber Bills
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            {business?.name ?? "Sin negocio cargado"}
          </h1>
          <p className="mt-2 text-zinc-400">
            {branch?.name ?? "Ejecutá el seed para cargar datos iniciales."}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {canManageSales ? (
              <>
                <Link
                  className="inline-flex rounded-lg bg-amber-400 px-4 py-2 font-semibold text-zinc-950 hover:bg-amber-300"
                  href="/sales/new"
                >
                  Registrar venta
                </Link>
                <Link
                  className="inline-flex rounded-lg border border-zinc-700 px-4 py-2 font-semibold text-zinc-100 hover:border-zinc-500"
                  href="/sales"
                >
                  Ver ventas recientes
                </Link>
              </>
            ) : (
              <Link
                className="inline-flex rounded-lg bg-amber-400 px-4 py-2 font-semibold text-zinc-950 hover:bg-amber-300"
                href="/login"
              >
                Ingresar como administrador
              </Link>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="text-lg font-semibold">Barberos</h2>
            <ul className="mt-4 space-y-3 text-zinc-300">
              {branch?.users.map((barber) => (
                <li key={barber.id}>{barber.name}</li>
              ))}
            </ul>
          </article>

          <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="text-lg font-semibold">Servicios</h2>
            <ul className="mt-4 space-y-3 text-zinc-300">
              {branch?.servicePrices.map((servicePrice) => (
                <li
                  className="flex items-center justify-between gap-4"
                  key={servicePrice.id}
                >
                  <span>{servicePrice.service.name}</span>
                  <span className="font-medium text-amber-400">
                    {formatMoney(servicePrice.price)}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>
    </main>
  );
}
