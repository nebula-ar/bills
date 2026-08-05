import { notFound } from "next/navigation";

import { formatMoney } from "@/components/manager-ui";
import { productImageSrc } from "@/modules/catalog/product-image-src.logic";
import { getCartaPorToken } from "@/modules/tables/carta-publica.use-case";

import { agregarDesdeCartaAction, quitarDelCarritoAction } from "./actions";

/**
 * La carta que el cliente abre escaneando el QR de su mesa.
 *
 * No hay login: el token de la mesa ES la credencial. Y no hay navegación de la
 * app — es una pantalla para alguien que está sentado esperando, no para
 * alguien que trabaja acá.
 *
 * Lo que carga entra como CARRITO y no viaja a cocina: lo confirma el mozo, que
 * es quien ve la mesa. Se lo decimos en pantalla para que no espere un café que
 * nadie mandó a hacer.
 */

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

type CartaPageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ cat?: string | string[]; estado?: string | string[]; mensaje?: string | string[] }>;
};

export default async function CartaPage({ params, searchParams }: CartaPageProps) {
  const { token } = await params;
  const query = await searchParams;

  const carta = await getCartaPorToken(token);
  if (!carta) notFound();

  const categorias = [...new Set(carta.productos.map((p) => p.categoria))];
  const catActiva = uno(query.cat);
  const visibles = catActiva ? carta.productos.filter((p) => p.categoria === catActiva) : carta.productos;

  const enCarrito = carta.carrito.reduce((suma, i) => suma + i.total, 0);
  const yaPedido = carta.confirmados.reduce((suma, i) => suma + i.total, 0);

  const mensaje = uno(query.mensaje);

  return (
    // `data-vertical` acá y no en el layout: esta página no tiene sesión, y las
    // variables del tema cascadean igual desde cualquier elemento.
    <main className="min-h-[100dvh] bg-background pb-40" data-vertical={carta.vertical}>
      <header className="bg-primary px-5 pb-6 pt-8 text-primary-foreground">
        <p className="text-sm font-bold uppercase tracking-[0.18em] opacity-80">{carta.negocio}</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">{carta.mesa.name}</h1>
        <p className="mt-1 text-sm opacity-90">
          Pedí desde acá. Un mozo confirma tu pedido antes de mandarlo a la cocina.
        </p>
      </header>

      <div className="px-4 pt-4">
        {mensaje ? (
          <p className="mb-3 rounded-xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
            {mensaje}
          </p>
        ) : null}

        {carta.confirmados.length > 0 ? (
          <section className="mb-4 rounded-2xl bg-white p-4">
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">Ya pedido</h2>
            <ul className="mt-2 flex flex-col gap-1">
              {carta.confirmados.map((i) => (
                <li className="flex justify-between text-sm font-semibold text-slate-700" key={i.id}>
                  <span>{i.description}</span>
                  <span>{formatMoney(i.total)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 border-t border-slate-100 pt-2 text-right text-base font-black text-slate-950">
              {formatMoney(yaPedido)}
            </p>
          </section>
        ) : null}

        {categorias.length > 1 ? (
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            <a
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${
                !catActiva ? "bg-primary text-primary-foreground" : "bg-white text-slate-600"
              }`}
              href={`/carta/${token}`}
            >
              Todo
            </a>
            {categorias.map((c) => (
              <a
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${
                  catActiva === c ? "bg-primary text-primary-foreground" : "bg-white text-slate-600"
                }`}
                href={`/carta/${token}?cat=${encodeURIComponent(c)}`}
                key={c}
              >
                {c}
              </a>
            ))}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          {visibles.map((p) => {
            const foto = productImageSrc({
              id: p.id,
              imageVersion: p.imageVersion,
              catalogSlug: p.catalogSlug,
            });

            return (
              <form action={agregarDesdeCartaAction} key={p.id}>
                <input name="token" type="hidden" value={token} />
                <input name="productId" type="hidden" value={p.id} />
                <button
                  className="flex w-full flex-col overflow-hidden rounded-2xl bg-white text-center shadow-sm ring-1 ring-slate-200 transition active:scale-[0.98]"
                  type="submit"
                >
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
                </button>
              </form>
            );
          })}
        </div>
      </div>

      {carta.carrito.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white p-4 shadow-[0_-8px_30px_rgba(15,23,42,0.1)]">
          <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">
            Tu pedido · esperando al mozo
          </h2>
          <ul className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto">
            {carta.carrito.map((i) => (
              <li className="flex items-center gap-2 text-sm font-semibold text-slate-800" key={i.id}>
                <span className="flex-1">
                  {i.description}
                  {i.modifiers.length > 0 ? (
                    <span className="ml-1 text-xs font-bold text-primary">
                      {i.modifiers.map((m) => m.name).join(" · ")}
                    </span>
                  ) : null}
                </span>
                <span>{formatMoney(i.total)}</span>
                <form action={quitarDelCarritoAction}>
                  <input name="token" type="hidden" value={token} />
                  <input name="itemId" type="hidden" value={i.id} />
                  <button
                    aria-label={`Quitar ${i.description}`}
                    className="grid size-6 place-items-center rounded-full text-slate-400"
                    type="submit"
                  >
                    ×
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <p className="mt-2 flex items-baseline justify-between border-t border-slate-100 pt-2">
            <span className="text-base font-black text-slate-950">Total</span>
            <span className="text-2xl font-black text-primary">{formatMoney(enCarrito)}</span>
          </p>
          <p className="mt-1 text-center text-xs text-slate-500">
            Avisale al mozo cuando termines. Él lo manda a la cocina.
          </p>
        </div>
      ) : null}
    </main>
  );
}
