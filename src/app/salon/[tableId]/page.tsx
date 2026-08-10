import Link from "next/link";
import { notFound } from "next/navigation";

import { formatMoney } from "@/components/manager-ui";
import { ComandaCatalog } from "@/components/comanda-catalog";
import { AppModule } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { capabilitiesOf } from "@/lib/capabilities";
import { formatQuantity, QUANTITY_SCALE } from "@/lib/quantity";
import { findOpenOrder, findProductosVendibles, findTable } from "@/modules/tables/orders.repository";
import { totalesDe } from "@/modules/tables/orders.use-cases";

import { cancelarComandaAction, confirmarCarritoAction, descartarCarritoAction, quitarProductoAction } from "./actions";

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
  searchParams: Promise<{ estado?: string | string[]; mensaje?: string | string[] }>;
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

  const todos = comanda?.items ?? [];
  // Lo que el cliente cargó por el QR y todavía no confirmó nadie. NO cuenta
  // para el total ni fue a cocina.
  const carrito = todos.filter((i) => i.kdsStatus === "CART");
  const items = todos.filter((i) => i.kdsStatus !== "CART");
  const totales = totalesDe(items, comanda?.discount ?? 0, comanda?.tip ?? 0);
  const puedeCobrar = capabilitiesOf(session.user.role).includes("sell");

  // Cuánto de cada producto ya está en la comanda, para el aviso en su
  // tarjeta ("3 en la comanda"). Cada toque crea un renglón propio —no se
  // funden en uno solo—, así que esto es la SUMA de todos esos renglones.
  // `quantity` viene en milésimas (ver src/lib/quantity.ts): acá siempre son
  // enteras (el salón vende unidades, no fracciones), así que dividir alcanza.
  const enComanda: Record<string, number> = {};
  for (const item of items) {
    if (!item.productId) continue;
    enComanda[item.productId] = (enComanda[item.productId] ?? 0) + item.quantity / QUANTITY_SCALE;
  }

  const mensaje = uno(query.mensaje);
  const estado = uno(query.estado);

  return (
    <main className="flex min-h-[100dvh] flex-col bg-background lg:h-screen lg:flex-row">
      {/* ── Productos ─────────────────────────────────────────────────── */}
      <section className="flex min-w-0 flex-1 flex-col p-4 pb-28 lg:p-6 lg:pb-28">
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

        <ComandaCatalog branchId={mesa.branchId} enComanda={enComanda} productos={productos} tableId={tableId} />
      </section>

      {/* ── La comanda ──────────────────────────────────────────────────
          En escritorio es la columna de la derecha y se ve entera. En el
          celular estaba DEBAJO del catálogo: para ver lo cargado había que
          scrollear toda la grilla de productos, que es justo lo que el mozo
          hace veinte veces por mesa. Ahora queda anclada abajo con su propio
          scroll —el mismo recurso que usa el POS con su barra de total—, así
          el catálogo pasa por detrás y lo pedido está siempre a la vista.

          `sticky` y no `fixed`: sigue ocupando su lugar en el flujo, así que
          no tapa el final del catálogo ni hace falta compensarlo con padding. */}
      <aside className="sticky bottom-0 z-10 flex max-h-[34dvh] w-full shrink-0 flex-col gap-2 border-t border-slate-200 bg-white p-3 pb-24 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] lg:static lg:max-h-none lg:gap-3 lg:w-[26rem] lg:border-l lg:border-t-0 lg:p-6 lg:pb-28 lg:shadow-none">
        <h2 className="shrink-0 text-lg font-black tracking-tight text-slate-950">Comanda</h2>

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

        {/* La lista es lo único que scrollea adentro de la comanda: el título y
            el botón de cobrar quedan fijos. Con `max-h` fija se comía el alto
            del botón cuando la mesa pedía mucho. */}
        {items.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            Tocá un producto para abrir la comanda.
          </p>
        ) : (
          <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
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

          {items.length > 0 && puedeCobrar && comanda ? (
            // Cobrar es del cajero, y ahora pasa por el cobro real: medio de
            // pago, pago dividido, propina, factura, y con stock y costo
            // congelado —lo que `cobrarComanda` nunca hizo—. Mismo botón, mismo
            // lugar; adentro ya no es una implementación aparte.
            <Link
              className="grid h-12 place-items-center rounded-full bg-primary text-base font-black text-primary-foreground transition hover:bg-primary-strong"
              href={`/sales/new?orderId=${comanda.id}`}
            >
              Cobrar {formatMoney(totales.total)}
            </Link>
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
