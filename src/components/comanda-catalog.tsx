"use client";

import {
  agregarProductoRapido,
  cancelarComandaAction,
  confirmarCarritoAction,
  descartarCarritoAction,
  quitarProductoAction,
  restarUnidadAction,
} from "@/app/salon/[tableId]/actions";
import { Check, Minus, Search, Trash2 } from "@/components/icons";
import { formatQuantity, QUANTITY_SCALE } from "@/lib/quantity";
import { productImageSrc } from "@/modules/catalog/product-image-src.logic";
import { useMemo, useOptimistic, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * La pantalla del mozo: la carta y la comanda, juntas y del lado del cliente.
 *
 * Antes la carta era cliente y la comanda la pintaba el servidor. Cada toque
 * era: acción al servidor (~150ms contra una base remota) + `router.refresh()`
 * repintando el árbol entero. Hasta que eso no volvía, en pantalla NO PASABA
 * NADA: se sentía lento y —peor— el mozo no veía qué había cargado, así que
 * tocaba de nuevo y cargaba dos.
 *
 * Ahora el renglón entra en la lista en el mismo toque (`useOptimistic`) y el
 * servidor confirma atrás. Si falla, el renglón se cae solo y se avisa.
 */

export type ComandaProduct = {
  id: string;
  name: string;
  price: number;
  categoria: string;
  imageVersion: number | null;
  catalogSlug: string | null;
  tieneOpciones: boolean;
};

export type ComandaItem = {
  id: string;
  productId: string | null;
  description: string;
  unitPrice: number;
  quantity: number;
  total: number;
  note: string | null;
  modifiers: { id: string; name: string }[];
};

function money(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

export function ComandaCatalog({
  encabezado,
  productos,
  itemsIniciales,
  borradorInicial,
  tableId,
  branchId,
  comandaId,
  descuento,
  propina,
  puedeCobrar,
}: {
  // El encabezado lo arma el servidor (nombre de la mesa, sector, número de
  // comanda) y se pasa como nodo: no hay motivo para que viaje como props
  // sueltas ni para que este componente sepa de dónde salen.
  encabezado: ReactNode;
  productos: ComandaProduct[];
  // Ya confirmado y en cocina. No se toca desde acá.
  itemsIniciales: ComandaItem[];
  // Borrador: cargado y todavía sin mandar. Es lo que el mozo revisa con el
  // cliente antes de confirmar.
  borradorInicial: ComandaItem[];
  tableId: string;
  branchId: string;
  comandaId: string | null;
  descuento: number;
  propina: number;
  puedeCobrar: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Lo último cargado, para el aviso grande: el mozo tiene que VER qué entró
  // sin buscarlo en la lista.
  const [ultimo, setUltimo] = useState<{ nombre: string; precio: number; n: number } | null>(null);
  const avisoTimer = useRef<number | null>(null);
  const [isPending, startTransition] = useTransition();

  // Lo que se toca entra al BORRADOR, en el mismo toque, y se reemplaza por el
  // renglón real cuando el servidor contesta y el árbol se refresca.
  //
  // Si ya hay un renglón sin opciones del mismo producto, se fusiona en vez de
  // agregar otra fila: así el optimista se ve igual que lo que el servidor va
  // a devolver (ver `agregarRenglon`), y no hay un parpadeo de "3 filas" que
  // se convierten en "1 fila" al refrescar.
  const [borrador, addOptimistic] = useOptimistic(borradorInicial, (actuales: ComandaItem[], nuevo: ComandaItem) => {
    const existente = actuales.find((item) => item.productId === nuevo.productId && item.modifiers.length === 0);

    if (existente) {
      return actuales.map((item) =>
        item === existente
          ? { ...item, quantity: item.quantity + nuevo.quantity, total: item.total + nuevo.total }
          : item,
      );
    }

    return [...actuales, nuevo];
  });
  const items = itemsIniciales;

  const categorias = useMemo(() => [...new Set(productos.map((p) => p.categoria))], [productos]);

  const visibles = useMemo(() => {
    const normalize = (value: string) =>
      value
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase();
    const query = normalize(search.trim());

    return productos
      .filter((p) => (categoria ? p.categoria === categoria : true))
      .filter((p) => (query ? normalize(p.name).includes(query) : true));
  }, [productos, search, categoria]);

  // Cuánto de cada producto hay cargado, contando lo optimista: la tarjeta
  // tiene que reflejar el toque en el acto, igual que la lista.
  const enComanda = useMemo(() => {
    const cuenta: Record<string, number> = {};
    // Cuenta borrador Y confirmado: la tarjeta dice cuánto lleva cargado el
    // producto, sin importar si ya se mandó a cocina.
    for (const item of [...items, ...borrador]) {
      if (!item.productId) continue;
      cuenta[item.productId] = (cuenta[item.productId] ?? 0) + item.quantity / QUANTITY_SCALE;
    }
    return cuenta;
  }, [items, borrador]);

  // El total es lo CONFIRMADO: un borrador todavía no se pidió, y cobrarlo
  // sería cobrar algo que la cocina nunca vio.
  const subtotal = items.reduce((suma, i) => suma + i.total, 0);
  const total = Math.max(0, subtotal - descuento) + propina;
  const totalBorrador = borrador.reduce((suma, i) => suma + i.total, 0);

  function agregar(producto: ComandaProduct) {
    setError(null);

    startTransition(async () => {
      addOptimistic({
        // Id temporal: solo vive hasta que el servidor confirme y el árbol se
        // repinte con el renglón real.
        id: `optimista-${producto.id}-${borrador.length}`,
        productId: producto.id,
        description: producto.name,
        unitPrice: producto.price,
        quantity: QUANTITY_SCALE,
        total: producto.price,
        note: null,
        modifiers: [],
      });

      const resultado = await agregarProductoRapido({ tableId, branchId, productId: producto.id });

      if (!resultado.ok) {
        // El optimista se cae solo al terminar la transición sin refresh.
        setError(resultado.error);
        return;
      }

      setUltimo((previo) => ({
        nombre: producto.name,
        precio: producto.price,
        n: previo && previo.nombre === producto.name ? previo.n + 1 : 1,
      }));
      if (avisoTimer.current) window.clearTimeout(avisoTimer.current);
      avisoTimer.current = window.setTimeout(() => setUltimo(null), 2600);

      router.refresh();
    });
  }

  // Quitar, restar, confirmar, descartar y cancelar comparten el mismo trato:
  // llamar a la acción directo (sin <form action>, que redirigía a la MISMA
  // ruta ya en pantalla y por eso no refrescaba nada) y, si sale bien, pedirle
  // al cliente que refresque. Cancelar es la excepción: la mesa se libera, así
  // que en vez de refrescar esta pantalla navega a la lista de mesas.
  function quitar(itemId: string) {
    setError(null);
    startTransition(async () => {
      const resultado = await quitarProductoAction({ tableId, itemId });
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      router.refresh();
    });
  }

  function restarUnaUnidad(itemId: string) {
    setError(null);
    startTransition(async () => {
      const resultado = await restarUnidadAction({ tableId, itemId });
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      router.refresh();
    });
  }

  function confirmarCarrito() {
    setError(null);
    startTransition(async () => {
      const resultado = await confirmarCarritoAction({ tableId });
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      router.refresh();
    });
  }

  function descartarCarrito() {
    setError(null);
    startTransition(async () => {
      const resultado = await descartarCarritoAction({ tableId });
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      router.refresh();
    });
  }

  function cancelarComanda() {
    setError(null);
    startTransition(async () => {
      const resultado = await cancelarComandaAction({ tableId });
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      router.push("/salon?estado=ok&mensaje=Comanda+cancelada");
    });
  }

  return (
    <>
      {/* ── La carta ──────────────────────────────────────────────────── */}
      <section className="flex min-w-0 flex-1 flex-col p-4 pb-4 lg:p-6 lg:pb-28">
        {encabezado}
        <div className="mb-2.5 flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              aria-label="Buscar en la carta"
              className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-base font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar en la carta…"
              value={search}
            />
          </div>
        </div>

        {categorias.length > 1 ? (
          <div className="-mx-1 mb-2.5 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              className={`flex min-h-11 shrink-0 items-center rounded-full px-4 py-2 text-base font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                categoria === null ? "bg-primary text-white" : "bg-white text-slate-600 ring-1 ring-slate-950/5"
              }`}
              onClick={() => setCategoria(null)}
              type="button"
            >
              Todo
            </button>
            {categorias.map((c) => (
              <button
                className={`flex min-h-11 shrink-0 items-center rounded-full px-4 py-2 text-base font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                  categoria === c ? "bg-primary text-white" : "bg-white text-slate-600 ring-1 ring-slate-950/5"
                }`}
                key={c}
                onClick={() => setCategoria(c)}
                type="button"
              >
                {c}
              </button>
            ))}
          </div>
        ) : null}

        {error ? (
          <p className="mb-2.5 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700" role="alert">
            {error}
          </p>
        ) : null}

        <div className="min-h-0 flex-1 lg:overflow-y-auto">
          {visibles.length === 0 ? (
            <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500">
              {productos.length === 0 ? "No hay productos con precio en esta sucursal." : "Nada con eso en la carta."}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 pb-4 sm:grid-cols-3 xl:grid-cols-4">
              {visibles.map((p) => {
                const foto = productImageSrc({ id: p.id, imageVersion: p.imageVersion, catalogSlug: p.catalogSlug });
                const cantidad = enComanda[p.id] ?? 0;

                const tarjeta = (
                  <>
                    <span className="relative block aspect-square w-full overflow-hidden bg-slate-100">
                      {foto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt="" className="size-full object-cover" loading="lazy" src={foto} />
                      ) : (
                        <span className="grid size-full place-items-center text-3xl">🍞</span>
                      )}
                      {cantidad > 0 ? (
                        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-black text-white shadow-sm">
                          <Check className="size-3" strokeWidth={3} />
                          {cantidad}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex flex-1 flex-col gap-1 p-3">
                      <span className="line-clamp-2 text-sm font-bold leading-tight text-slate-950">{p.name}</span>
                      <span className="text-base font-black text-primary">{money(p.price)}</span>
                    </span>
                  </>
                );

                const clase =
                  "group flex w-full flex-col overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-slate-200 transition active:scale-[0.96]";

                return p.tieneOpciones ? (
                  <Link className={clase} href={`/salon/${tableId}/opciones/${p.id}`} key={p.id}>
                    {tarjeta}
                  </Link>
                ) : (
                  <button className={clase} key={p.id} onClick={() => agregar(p)} type="button">
                    {tarjeta}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── La comanda ────────────────────────────────────────────────────
          En el celular es una hoja anclada abajo. El alto lo manda la LISTA:
          antes estaba fija en 34dvh y, entre el título, el total y los dos
          botones, a los renglones les quedaban 60px —el mozo veía el total y
          nada más—. Ahora crece con lo que hay, hasta la mitad de la pantalla,
          y la lista es lo único que scrollea. */}
      <aside className="sticky bottom-0 z-10 flex max-h-[50dvh] w-full shrink-0 flex-col gap-2 border-t border-slate-200 bg-white p-3 pb-24 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] lg:static lg:max-h-none lg:w-[26rem] lg:gap-3 lg:border-l lg:border-t-0 lg:p-6 lg:pb-28 lg:shadow-none">
        {/* Lo último cargado, arriba de todo y grande: es la confirmación de
            que el toque entró. Sin esto el mozo vuelve a tocar y carga dos. */}
        {ultimo ? (
          <div className="flex shrink-0 items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 duration-200 animate-in fade-in slide-in-from-bottom-1">
            <Check className="size-4 shrink-0 text-emerald-600" strokeWidth={3} />
            <span className="min-w-0 flex-1 truncate text-sm font-black text-emerald-900">
              {ultimo.n > 1 ? `${ultimo.n}× ` : ""}
              {ultimo.nombre}
            </span>
            <span className="shrink-0 text-sm font-black text-emerald-700">{money(ultimo.precio)}</span>
          </div>
        ) : null}

        <div className="flex shrink-0 items-baseline justify-between">
          <h2 className="text-lg font-black tracking-tight text-slate-950">En cocina</h2>
          <span className="text-sm font-bold text-slate-500">
            {items.length} {items.length === 1 ? "ítem" : "ítems"}
          </span>
        </div>

        {/* El borrador: lo cargado y todavía sin mandar. Es lo que el mozo
            repasa con el cliente antes de que la cocina empiece. */}
        {borrador.length > 0 ? (
          <section className="shrink-0 rounded-xl border border-primary/40 bg-primary/10 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-black text-slate-950">
                Sin confirmar · {borrador.length} {borrador.length === 1 ? "ítem" : "ítems"}
              </p>
              <span className="text-sm font-black text-primary">{money(totalBorrador)}</span>
            </div>
            <ul className="mt-1.5 flex max-h-32 flex-col gap-1 overflow-y-auto">
              {borrador.map((i) => {
                const enVuelo = i.id.startsWith("optimista-");
                return (
                  <li className="flex items-center gap-2 text-sm font-semibold text-slate-700" key={i.id}>
                    <span className="shrink-0 text-xs font-black text-slate-500">{formatQuantity(i.quantity)}×</span>
                    <span className="min-w-0 flex-1 truncate">
                      {i.description}
                      {i.modifiers.length > 0 ? (
                        <span className="ml-1 text-xs font-bold text-primary">
                          {i.modifiers.map((m) => m.name).join(" · ")}
                        </span>
                      ) : null}
                    </span>
                    {enVuelo ? (
                      <span className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    ) : (
                      <>
                        {/* Baja de a una unidad la fila fusionada, sin tener que
                            borrarla entera para sacar solo una. */}
                        {i.quantity > QUANTITY_SCALE ? (
                          <button
                            aria-label={`Sacar una unidad de ${i.description}`}
                            className="grid size-7 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-950/5 hover:text-slate-700 disabled:opacity-50"
                            disabled={isPending}
                            onClick={() => restarUnaUnidad(i.id)}
                            type="button"
                          >
                            <Minus className="size-3.5" />
                          </button>
                        ) : null}
                        <button
                          aria-label={`Quitar ${i.description}`}
                          className="grid size-7 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                          disabled={isPending}
                          onClick={() => quitar(i.id)}
                          type="button"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="mt-2 flex gap-2">
              {/* Acá arranca el workflow: recién con esto la cocina lo ve. */}
              <button
                className="h-11 flex-1 rounded-full bg-primary text-sm font-black text-primary-foreground disabled:opacity-60"
                disabled={isPending}
                onClick={confirmarCarrito}
                type="button"
              >
                Confirmar pedido
              </button>
              <button
                className="h-11 rounded-full px-4 text-sm font-bold text-slate-500 disabled:opacity-60"
                disabled={isPending}
                onClick={descartarCarrito}
                type="button"
              >
                Descartar
              </button>
            </div>
          </section>
        ) : null}

        {items.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">{borrador.length > 0 ? "Confirmá el pedido para que la cocina lo vea." : "Tocá un producto para abrir la comanda."}</p>
        ) : (
          <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
            {items.map((i) => {
              // El optimista todavía no existe en la base: no se puede quitar
              // hasta que tenga id real, o el borrado apuntaría a la nada.
              const enVuelo = i.id.startsWith("optimista-");

              return (
                <li
                  className={`flex items-start gap-2.5 rounded-xl p-2.5 transition ${
                    enVuelo ? "bg-primary/10" : "bg-slate-50"
                  }`}
                  key={i.id}
                >
                  <span className="mt-0.5 shrink-0 rounded-md bg-white px-1.5 py-0.5 text-xs font-black text-slate-700 ring-1 ring-slate-950/5">
                    {formatQuantity(i.quantity)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold leading-tight text-slate-950">{i.description}</p>
                    {i.modifiers.length > 0 ? (
                      <p className="text-xs font-semibold text-primary">{i.modifiers.map((m) => m.name).join(" · ")}</p>
                    ) : null}
                    {i.note ? <p className="text-xs italic text-slate-500">{i.note}</p> : null}
                  </div>
                  <span className="shrink-0 text-sm font-black text-slate-950">{money(i.total)}</span>
                  {enVuelo ? (
                    <span className="mt-0.5 size-4 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  ) : (
                    <button
                      aria-label={`Quitar ${i.description}`}
                      className="grid size-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                      disabled={isPending}
                      onClick={() => quitar(i.id)}
                      type="button"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-auto flex shrink-0 flex-col gap-2 border-t border-slate-200 pt-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-base font-black text-slate-950">Total</span>
            <span className="text-2xl font-black text-primary" style={{ fontVariantNumeric: "tabular-nums" }}>
              {money(total)}
            </span>
          </div>

          {items.length > 0 && borrador.length === 0 && puedeCobrar && comandaId ? (
            <Link
              className={`grid h-12 place-items-center rounded-full bg-primary text-base font-black text-primary-foreground transition hover:bg-primary-strong ${
                isPending ? "pointer-events-none opacity-60" : ""
              }`}
              href={`/sales/new?orderId=${comandaId}`}
            >
              Cobrar {money(total)}
            </Link>
          ) : null}

          {items.length > 0 && borrador.length === 0 && !puedeCobrar ? (
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-center text-sm text-slate-500">
              Avisale al cajero para cobrar esta mesa.
            </p>
          ) : null}

          {comandaId ? (
            <button
              className="h-10 w-full rounded-full text-sm font-bold text-slate-500 transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
              disabled={isPending}
              onClick={cancelarComanda}
              type="button"
            >
              Cancelar comanda
            </button>
          ) : null}
        </div>
      </aside>
    </>
  );
}
