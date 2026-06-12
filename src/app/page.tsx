import { prisma } from "@/lib/prisma";

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function Home() {
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
              role: "BARBER",
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
