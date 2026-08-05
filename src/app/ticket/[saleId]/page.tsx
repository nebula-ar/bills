import { notFound } from "next/navigation";

import { SaleChannel } from "@/generated/prisma/client";
import { requireCapability } from "@/lib/auth";
import { formatQuantity } from "@/lib/quantity";
import { prisma } from "@/lib/prisma";

/**
 * El comprobante que se le da al cliente.
 *
 * No es una factura: la facturación electrónica es otro módulo. Esto es el
 * papelito del mostrador, y por eso está pensado para una impresora térmica de
 * 58/80 mm — de ahí el ancho fijo, la tipografía monoespaciada y el blanco y
 * negro. En pantalla se ve igual, para que lo que se ve sea lo que sale.
 *
 * Se imprime solo al abrir: quien entra acá es porque va a imprimir.
 */

const fechaHora = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const pesos = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0 });

type TicketPageProps = { params: Promise<{ saleId: string }> };

export default async function TicketPage({ params }: TicketPageProps) {
  // Vender no es un módulo opcional en Bills: está siempre. Lo que se controla
  // es quién puede ver una venta ya hecha.
  const session = await requireCapability("viewSales");
  const { saleId } = await params;

  const venta = await prisma.sale.findFirst({
    where: { id: saleId, branch: { businessId: session.user.businessId }, deleted: false },
    select: {
      id: true,
      subtotal: true,
      discountTotal: true,
      tip: true,
      total: true,
      soldAt: true,
      channel: true,
      tableName: true,
      waiterName: true,
      branch: { select: { name: true, business: { select: { name: true, vertical: true } } } },
      items: {
        select: {
          id: true,
          description: true,
          quantity: true,
          unitPrice: true,
          total: true,
          modifiers: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!venta) notFound();

  return (
    <main
      className="mx-auto max-w-[80mm] bg-white p-4 font-mono text-[13px] leading-snug text-black"
      data-vertical={venta.branch.business.vertical}
    >
      {/* Imprime al abrir y vuelve atrás al terminar: nadie entra a un ticket
          para mirarlo, entra para darlo. */}
      <script dangerouslySetInnerHTML={{ __html: "window.onload=()=>window.print()" }} />

      <header className="text-center">
        <p className="text-base font-bold uppercase">{venta.branch.business.name}</p>
        <p>{venta.branch.name}</p>
        <p className="mt-1">{fechaHora.format(venta.soldAt)}</p>
        {venta.channel === SaleChannel.TABLE && venta.tableName ? (
          <p className="mt-1 font-bold">
            {venta.tableName}
            {venta.waiterName ? ` · ${venta.waiterName}` : ""}
          </p>
        ) : null}
      </header>

      <hr className="my-2 border-dashed border-black" />

      <ul>
        {venta.items.map((i) => (
          <li className="mb-1" key={i.id}>
            <div className="flex justify-between gap-2">
              <span className="flex-1">{i.description}</span>
              <span>{pesos.format(i.total)}</span>
            </div>
            <div className="text-[11px]">
              {formatQuantity(i.quantity)} × {pesos.format(i.unitPrice)}
            </div>
            {i.modifiers.length > 0 ? (
              <div className="text-[11px]">+ {i.modifiers.map((m) => m.name).join(", ")}</div>
            ) : null}
          </li>
        ))}
      </ul>

      <hr className="my-2 border-dashed border-black" />

      <div className="flex justify-between">
        <span>Subtotal</span>
        <span>{pesos.format(venta.subtotal)}</span>
      </div>
      {venta.discountTotal > 0 ? (
        <div className="flex justify-between">
          <span>Descuento</span>
          <span>−{pesos.format(venta.discountTotal)}</span>
        </div>
      ) : null}
      {venta.tip > 0 ? (
        <div className="flex justify-between">
          {/* La propina se muestra aparte: es plata del mozo, no del negocio. */}
          <span>Propina</span>
          <span>{pesos.format(venta.tip)}</span>
        </div>
      ) : null}

      <div className="mt-1 flex justify-between text-base font-bold">
        <span>TOTAL</span>
        <span>{pesos.format(venta.total)}</span>
      </div>

      <hr className="my-2 border-dashed border-black" />

      <footer className="text-center text-[11px]">
        <p>¡Gracias por tu compra!</p>
        {/* Se dice explícitamente para que nadie lo presente como factura. */}
        <p className="mt-1">Comprobante no válido como factura</p>
      </footer>
    </main>
  );
}
