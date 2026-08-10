"use client";

import { agregarProductoRapido } from "@/app/salon/[tableId]/actions";
import { Check, Search } from "@/components/icons";
import { productImageSrc } from "@/modules/catalog/product-image-src.logic";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * La carta de la mesa: buscar, filtrar por categoría, tocar para agregar.
 *
 * Mismo lenguaje visual que el mostrador (src/components/pos-checkout.tsx):
 * buscador, chips de categoría, tarjeta con foto. Tocar un producto acá no
 * navega —antes era un <form> que redirigía a la misma URL, y ESE viaje
 * completo, con el catálogo entero volviendo a pintarse, era lo que hacía que
 * cargar una mesa se sintiera distinto a cobrar en el mostrador—. Ahora agrega
 * en el momento y refresca solo, sin perder el scroll ni el buscador escrito.
 *
 * Lo que NO hace, a propósito: no junta toques del mismo producto en un solo
 * renglón con +/-. Cada toque crea un ítem nuevo en la comanda (así funciona
 * hoy `agregarRenglon`), así que "cuántos hay" es la suma de esos renglones,
 * no un contador que se pueda restar tocando "-". Restar se sigue haciendo
 * sobre el renglón puntual, en la lista de la comanda.
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

function money(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

export function ComandaCatalog({
  productos,
  tableId,
  branchId,
  enComanda,
}: {
  productos: ComandaProduct[];
  tableId: string;
  branchId: string;
  // Cuántos de cada producto ya están cargados en la comanda (sumando todos
  // los renglones de ese producto, sin importar cuándo se agregaron).
  enComanda: Record<string, number>;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);
  // Qué producto tiene un agregado en vuelo: solo ese pulsa mientras espera al
  // servidor, no toda la grilla.
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

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

  function agregar(productId: string) {
    setError(null);
    setPending(productId);
    startTransition(async () => {
      const resultado = await agregarProductoRapido({ tableId, branchId, productId });
      setPending(null);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
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
          <div className="grid grid-cols-2 gap-3 pb-24 sm:grid-cols-3 xl:grid-cols-4">
            {visibles.map((p) => {
              const foto = productImageSrc({ id: p.id, imageVersion: p.imageVersion, catalogSlug: p.catalogSlug });
              const cantidad = enComanda[p.id] ?? 0;
              const cargando = pending === p.id;

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
                        {cantidad} en la comanda
                      </span>
                    ) : null}
                    {cargando ? (
                      <span className="absolute inset-0 grid place-items-center bg-white/70">
                        <span className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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
                "group flex w-full flex-col overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-slate-200 transition active:scale-[0.98] disabled:pointer-events-none";

              // Con opciones se va a elegirlas: sigue siendo una navegación
              // real, porque hay algo que decidir antes de cargarlo (la
              // opciones no se pueden apurar con un toque solo).
              return p.tieneOpciones ? (
                <Link className={clase} href={`/salon/${tableId}/opciones/${p.id}`} key={p.id}>
                  {tarjeta}
                </Link>
              ) : (
                <button className={clase} disabled={cargando} key={p.id} onClick={() => agregar(p.id)} type="button">
                  {tarjeta}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
