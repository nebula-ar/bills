import Link from "next/link";
import { notFound } from "next/navigation";

import { formatMoney, inputClass } from "@/components/manager-ui";
import { AppModule } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { findGruposDeProducto } from "@/modules/catalog/modifiers.repository";
import { findPrecioEnSucursal, findTable } from "@/modules/tables/orders.repository";

import { agregarConOpcionesAction } from "../../actions";

/**
 * Elegir las opciones antes de mandar el producto a la comanda.
 *
 * Es una pantalla y no un diálogo a propósito: el mozo la usa de pie, con una
 * mano, y un modal en un celular chico deja los botones donde no llega el
 * pulgar. Además así el estado vive en la URL y el "atrás" del teléfono hace
 * lo que uno espera.
 */

type OpcionesProductoProps = {
  params: Promise<{ tableId: string; productId: string }>;
  searchParams: Promise<{ estado?: string | string[]; mensaje?: string | string[] }>;
};

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function OpcionesDelProducto({ params, searchParams }: OpcionesProductoProps) {
  const { session } = await requireModule(AppModule.TABLES);
  const { tableId, productId } = await params;
  const query = await searchParams;

  const mesa = await findTable(session.user.businessId, tableId);
  if (!mesa) notFound();

  const [precio, grupos] = await Promise.all([
    findPrecioEnSucursal(productId, mesa.branchId),
    findGruposDeProducto(session.user.businessId, productId),
  ]);

  if (!precio) notFound();

  const mensaje = uno(query.mensaje);

  return (
    <main className="min-h-[100dvh] bg-background p-4 pb-28">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
        <div className="flex items-center gap-3">
          <Link
            className="grid size-11 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-lg font-bold text-slate-600"
            href={`/salon/${tableId}`}
          >
            ‹
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-black tracking-tight text-slate-950">
              {precio.product.name}
            </h1>
            <p className="text-sm text-slate-500">
              {formatMoney(precio.price)} · {mesa.name}
            </p>
          </div>
        </div>

        {mensaje ? (
          <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
            {mensaje}
          </p>
        ) : null}

        <form action={agregarConOpcionesAction} className="flex flex-col gap-4">
          <input name="tableId" type="hidden" value={tableId} />
          <input name="branchId" type="hidden" value={mesa.branchId} />
          <input name="productId" type="hidden" value={productId} />

          {grupos.map((grupo) => (
            <section className="rounded-2xl bg-white p-4" key={grupo.id}>
              <div className="mb-3">
                <h2 className="text-lg font-black tracking-tight text-slate-950">{grupo.name}</h2>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {grupo.maxSelect <= 1
                    ? grupo.required
                      ? "Elegí una · obligatorio"
                      : "Elegí una"
                    : `Hasta ${grupo.maxSelect}${grupo.minSelect > 0 ? ` · mínimo ${grupo.minSelect}` : ""}`}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                {grupo.modifiers.map((m) => (
                  <label
                    className="flex cursor-pointer items-center gap-3 rounded-xl bg-slate-50 p-3 has-[:checked]:bg-primary/10 has-[:checked]:ring-1 has-[:checked]:ring-primary"
                    key={m.id}
                  >
                    <input
                      className="size-5 accent-[var(--primary)]"
                      name="modifierIds"
                      // Un grupo de "elegí una" se comporta como radio, pero el
                      // name es el mismo para que la validación del servidor
                      // reciba la selección entera y cuente los repetidos.
                      type={grupo.maxSelect <= 1 ? "radio" : "checkbox"}
                      value={m.id}
                    />
                    <span className="flex-1 text-sm font-bold text-slate-950">{m.name}</span>
                    {m.priceDelta !== 0 ? (
                      <span
                        className={`text-sm font-black ${
                          m.priceDelta > 0 ? "text-primary" : "text-destructive"
                        }`}
                      >
                        {m.priceDelta > 0 ? "+" : "−"}
                        {formatMoney(Math.abs(m.priceDelta))}
                      </span>
                    ) : null}
                  </label>
                ))}
              </div>
            </section>
          ))}

          <section className="rounded-2xl bg-white p-4">
            <label className="text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor="note">
              Aclaración para la cocina
            </label>
            <input
              className={`${inputClass} mt-2`}
              id="note"
              maxLength={140}
              name="note"
              placeholder="Ej: bien caliente, sin azúcar"
            />
          </section>

          <button
            className="grid h-14 place-items-center rounded-full bg-primary text-base font-black text-primary-foreground transition hover:bg-primary-strong"
            type="submit"
          >
            Agregar a la comanda
          </button>
        </form>
      </div>
    </main>
  );
}
