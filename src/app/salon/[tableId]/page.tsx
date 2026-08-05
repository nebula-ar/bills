import Link from "next/link";
import { notFound } from "next/navigation";

import { formatMoney } from "@/components/manager-ui";
import { AppModule } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { capabilitiesOf } from "@/lib/capabilities";
import { formatQuantity } from "@/lib/quantity";
import { productImageSrc } from "@/modules/catalog/product-image-src.logic";
import { findOpenOrder, findProductosVendibles, findTable } from "@/modules/tables/orders.repository";
import { totalesDe } from "@/modules/tables/orders.use-cases";

import {
  agregarProductoAction,
  cancelarComandaAction,
  cobrarAction,
  confirmarCarritoAction,
  descartarCarritoAction,
  quitarProductoAction,
} from "./actions";

/**
 * La comanda de una mesa: tocar el producto lo agrega.
 *
 * En el mostrador se vende MIRANDO, no leyendo, así que el producto es su foto
 * y ocupa el espacio. La comanda va al costado en pantalla grande y abajo en
 * el celular, que es como la usa el mozo: en la mano, de pie, al lado de la
 * mesa.
 */

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

type ComandaPageProps = {
  params: Promise<{ tableId: string }>;
  searchParams: Promise<{ cat?: string | string[]; estado?: string | string[]; mensaje?: string | string[] }>;
};

export default async function ComandaPage({ params, searchParams }: ComandaPageProps) {
  const { session } = await requireModule(AppModule.TABLES);
  const { tableId } = await params;
  const query = await searchParams;

  const mesa = await findTable(session.user.businessId, tableId);
  if (!mesa) notFound();

  const [productos, comanda] = await Promise.all([
    findProductosVendibles(session.user.businessId, mesa.branchId),
    findOpenOrder(tableId),
  ]);

  const categorias = [...new Set(productos.map((p) => p.categoria))];
  const catActiva = uno(query.cat);
  const visibles = catActiva ? productos.filter((p) => p.categoria === catActiva) : productos;

  const todos = comanda?.items ?? [];
  // Lo que el cliente cargó por el QR y todavía no confirmó nadie. NO cuenta
  // para el total ni fue a cocina.
  const carrito = todos.filter((i) => i.kdsStatus === "CART");
  const items = todos.filter((i) => i.kdsStatus !== "CART");
  const totales = totalesDe(items, comanda?.discount ?? 0, comanda?.tip ?? 0);
  const puedeCobrar = capabilitiesOf(session.user.role).includes("sell");

  const mensaje = uno(query.mensaje);
  const estado = uno(query.estado);

  return (
    <main className="flex min-h-[100dvh] flex-col bg-background lg:h-screen lg:flex-row">
      {/* ── Productos ─────────────────────────────────────────────────── */}
      <section className="flex min-w-0 flex-1 flex-col p-4 pb-28 lg:p-6 lg:pb-6">
        <div className="mb-4 flex items-center gap-3">
          <Link
            className="grid size-11 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-lg font-bold text-slate-600 transition hover:bg-slate-50"
            href="/salon"
          >
            ‹
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-black tracking-tight text-slate-950">{mesa.name}</h1>
            <p className="text-sm text-slate-500">
              {mesa.sector?.name ?? "Sin sector"}
              {comanda ? ` · comanda #${comanda.number}` : " · sin comanda"}
            </p>
          </div>
        </div>

        {mensaje ? (
          <p
            className={`mb-3 rounded-xl px-4 py-3 text-sm font-semibold ${
              estado === "error" ? "bg-destructive/10 text-destructive" : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {mensaje}
          </p>
        ) : null}

        {categorias.length > 1 ? (
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            <Link
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${
                !catActiva ? "bg-primary text-primary-foreground" : "bg-white text-slate-600 hover:bg-slate-100"
              }`}
              href={`/salon/${tableId}`}
            >
              Todo
            </Link>
            {categorias.map((c) => (
              <Link
                key={c}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${
                  catActiva === c ? "bg-primary text-primary-foreground" : "bg-white text-slate-600 hover:bg-slate-100"
                }`}
                href={`/salon/${tableId}?cat=${encodeURIComponent(c)}`}
              >
                {c}
              </Link>
            ))}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 lg:overflow-y-auto">
          {visibles.length === 0 ? (
            <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500">
              No hay productos con precio en esta sucursal.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {visibles.map((p) => {
                const foto = productImageSrc({
                  id: p.id,
                  imageVersion: p.imageVersion,
                  catalogSlug: p.catalogSlug,
                });

                const tarjeta = (
                  <>
                      <span className="block aspect-square w-full overflow-hidden bg-slate-100">
                        {foto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img alt="" className="size-full object-cover" src={foto} />
                        ) : (
                          <span className="grid size-full place-items-center text-3xl">🍞</span>
                        )}
                      </span>
                    <span className="flex flex-1 flex-col gap-1 p-3">
                      <span className="text-sm font-bold leading-tight text-slate-950">{p.name}</span>
                      <span className="text-base font-black text-primary">{formatMoney(p.price)}</span>
                    </span>
                  </>
                );

                const clase =
                  "group flex w-full flex-col overflow-hidden rounded-2xl bg-white text-center shadow-sm ring-1 ring-slate-200 transition active:scale-[0.98]";

                // Con opciones se va a elegirlas; sin opciones se agrega de una.
                // Meter un diálogo para "sin azúcar" cuando no hay nada que
                // elegir sería un toque de más en la pantalla que más se toca.
                return p.tieneOpciones ? (
                  <Link className={clase} href={`/salon/${tableId}/opciones/${p.id}`} key={p.id}>
                    {tarjeta}
                  </Link>
                ) : (
                  <form action={agregarProductoAction} key={p.id}>
                    <input name="tableId" type="hidden" value={tableId} />
                    <input name="branchId" type="hidden" value={mesa.branchId} />
                    <input name="productId" type="hidden" value={p.id} />
                    <input name="unidades" type="hidden" value={1} />
                    <button className={clase} type="submit">
                      {tarjeta}
                    </button>
                  </form>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── La comanda ────────────────────────────────────────────────── */}
      <aside className="flex w-full shrink-0 flex-col gap-3 border-t border-slate-200 bg-white p-4 pb-28 lg:w-[26rem] lg:border-l lg:border-t-0 lg:p-6 lg:pb-6">
        <h2 className="text-lg font-black tracking-tight text-slate-950">Comanda</h2>

        {carrito.length > 0 ? (
          <section className="rounded-xl border border-primary/40 bg-primary/10 p-3">
            <p className="text-sm font-black text-slate-950">
              La mesa pidió {carrito.length} {carrito.length === 1 ? "cosa" : "cosas"} por el QR
            </p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {carrito.map((i) => (
                <li className="text-sm font-semibold text-slate-700" key={i.id}>
                  {i.description}
                  {i.modifiers.length > 0 ? (
                    <span className="ml-1 text-xs font-bold text-primary">
                      {i.modifiers.map((m) => m.name).join(" · ")}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <form action={confirmarCarritoAction} className="flex-1">
                <input name="tableId" type="hidden" value={tableId} />
                <button
                  className="h-10 w-full rounded-full bg-primary text-sm font-black text-primary-foreground"
                  type="submit"
                >
                  Mandar a cocina
                </button>
              </form>
              <form action={descartarCarritoAction}>
                <input name="tableId" type="hidden" value={tableId} />
                <button className="h-10 rounded-full px-4 text-sm font-bold text-slate-500" type="submit">
                  Descartar
                </button>
              </form>
            </div>
          </section>
        ) : null}

        {items.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            Tocá un producto para abrir la comanda.
          </p>
        ) : (
          <ul className="flex max-h-[40vh] flex-col gap-2 overflow-y-auto lg:max-h-none lg:flex-1">
            {items.map((i) => (
              <li className="flex items-start gap-3 rounded-xl bg-slate-50 p-3" key={i.id}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold leading-tight text-slate-950">{i.description}</p>
                  <p className="text-xs text-slate-500">
                    {formatQuantity(i.quantity)} × {formatMoney(i.unitPrice)}
                  </p>
                  {i.modifiers.length > 0 ? (
                    <p className="mt-0.5 text-xs font-semibold text-primary">
                      {i.modifiers.map((m) => m.name).join(" · ")}
                    </p>
                  ) : null}
                  {i.note ? <p className="mt-1 text-xs italic text-slate-500">{i.note}</p> : null}
                </div>
                <span className="shrink-0 text-sm font-black text-slate-950">{formatMoney(i.total)}</span>
                <form action={quitarProductoAction}>
                  <input name="tableId" type="hidden" value={tableId} />
                  <input name="itemId" type="hidden" value={i.id} />
                  <button
                    aria-label={`Quitar ${i.description}`}
                    className="grid size-7 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-destructive/10 hover:text-destructive"
                    type="submit"
                  >
                    ×
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto flex flex-col gap-3 border-t border-slate-200 pt-3">
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-black text-slate-950">Total</span>
            <span className="text-3xl font-black text-primary">{formatMoney(totales.total)}</span>
          </div>

          {items.length > 0 && puedeCobrar ? (
            <form action={cobrarAction} className="flex flex-col gap-2">
              <input name="tableId" type="hidden" value={tableId} />
              {/* La propina es del mozo y va aparte del subtotal: sumarla a lo
                  facturado infla la contabilidad del negocio con plata ajena. */}
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                Propina
                <input
                  className="h-10 w-28 rounded-xl border border-slate-200 px-3 text-right font-bold text-slate-950"
                  defaultValue={0}
                  min={0}
                  name="propina"
                  step={100}
                  type="number"
                />
              </label>
              <button
                className="grid h-12 place-items-center rounded-full bg-primary text-base font-black text-primary-foreground transition hover:bg-primary-strong"
                type="submit"
              >
                Cobrar {formatMoney(totales.total)}
              </button>
            </form>
          ) : null}

          {items.length > 0 && !puedeCobrar ? (
            <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-center text-sm text-slate-500">
              Avisale al cajero para cobrar esta mesa.
            </p>
          ) : null}

          {comanda ? (
            <form action={cancelarComandaAction}>
              <input name="tableId" type="hidden" value={tableId} />
              <button
                className="h-11 w-full rounded-full text-sm font-bold text-slate-500 transition hover:bg-destructive/10 hover:text-destructive"
                type="submit"
              >
                Cancelar comanda
              </button>
            </form>
          ) : null}
        </div>
      </aside>
    </main>
  );
}
