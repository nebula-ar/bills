import Link from "next/link";
import { notFound } from "next/navigation";

import { ComandaCatalog } from "@/components/comanda-catalog";
import { AppModule } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { capabilitiesOf } from "@/lib/capabilities";
import { findOpenOrder, findProductosVendibles, findTable } from "@/modules/tables/orders.repository";

/**
 * La comanda de una mesa: tocar el producto lo agrega.
 *
 * Esta página solo lee y arma los datos. La pantalla entera —carta y comanda—
 * la pinta `ComandaCatalog` del lado del cliente: tocar un producto tiene que
 * verse en el acto, y con la lista pintada por el servidor había que esperar
 * la ida y vuelta para que apareciera el renglón.
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
  const puedeCobrar = capabilitiesOf(session.user.role).includes("sell");

  const mensaje = uno(query.mensaje);
  const estado = uno(query.estado);

  return (
    <main className="flex min-h-[100dvh] flex-col bg-background lg:h-screen lg:flex-row">
      <ComandaCatalog
        branchId={mesa.branchId}
        carrito={carrito.map((i) => ({ id: i.id, description: i.description, modifiers: i.modifiers }))}
        comandaId={comanda?.id ?? null}
        descuento={comanda?.discount ?? 0}
        encabezado={
          <>
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
          </>
        }
        itemsIniciales={items.map((i) => ({
          id: i.id,
          productId: i.productId,
          description: i.description,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
          total: i.total,
          note: i.note,
          modifiers: i.modifiers.map((m) => ({ id: m.id, name: m.name })),
        }))}
        productos={productos}
        propina={comanda?.tip ?? 0}
        puedeCobrar={puedeCobrar}
        tableId={tableId}
      />
    </main>
  );
}
