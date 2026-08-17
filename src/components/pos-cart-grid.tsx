"use client";

// Detalle del pedido en venta con Syncfusion EJ2 DataGrid (ej2-grids).
//
// Es el mismo componente en los dos lugares que muestran los renglones de la
// venta: el panel "Pedido" de escritorio (modo resumen, sin controles) y el
// paso "Tu pedido" del cobro (modo interactivo, con +/- y quitar). Con
// `interactive` los renglones llevan los controles de cantidad; sin él son una
// lista de solo lectura, igual de compacta que la custom que reemplaza.
//
// Las cantidades viajan en MILÉSIMAS de unidad (ver src/lib/quantity.ts), igual
// que en el carrito del mostrador; acá solo se formatean para mostrar.
import { GridComponent, ColumnsDirective, ColumnDirective } from "@syncfusion/ej2-react-grids";
import { Minus, Plus, Trash2 } from "@/components/icons";
import type { Unit } from "@/generated/prisma/enums";
import { allowsFraction, formatQuantity, lineTotal } from "@/lib/quantity";

export type PosCartGridItem = {
  productId: string;
  name: string;
  price: number;
  unit: Unit;
  // Milésimas de unidad (ver src/lib/quantity.ts).
  quantity: number;
  imageSrc?: string | null;
};

function money(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

export function PosCartGrid({
  items,
  interactive = false,
  height = "100%",
  onAdd,
  onDecrease,
  onRemove,
}: {
  items: PosCartGridItem[];
  // Con controles de cantidad (paso "Tu pedido" del cobro) o solo lectura
  // (panel "Pedido" de escritorio).
  interactive?: boolean;
  // "100%" para que el grid scrollee adentro del panel que lo contiene;
  // "auto" para que crezca y scrollee el contenedor externo (paso del cobro).
  height?: string;
  onAdd?: (productId: string) => void;
  onDecrease?: (productId: string) => void;
  onRemove?: (productId: string) => void;
}) {
  const quantityLabel = (row: PosCartGridItem) =>
    formatQuantity(row.quantity, allowsFraction(row.unit) ? row.unit : undefined);

  return (
    <GridComponent
      allowTextWrap
      cssClass="e-pos-cart-grid"
      dataSource={items}
      height={height}
      width="100%"
    >
      <ColumnsDirective>
        <ColumnDirective
          field="name"
          headerText="Producto"
          width="auto"
          template={(row: PosCartGridItem) => (
            <div className="flex min-w-0 items-center gap-2">
              {row.imageSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt=""
                  className="size-9 shrink-0 rounded-lg bg-slate-100 object-cover"
                  src={row.imageSrc}
                />
              ) : null}
              <span className="min-w-0">
                {/* Dos renglones antes que recortar. Es el momento de tomar plata:
                    "Capuc…" no se puede verificar, y un nombre a medias es lo
                    que hace que alguien cobre otra cosa sin enterarse. */}
                <span className="block font-black leading-snug text-slate-950 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                  {row.name}
                </span>
                {interactive ? (
                  <span className="block text-xs font-bold text-slate-400">
                    {money(row.price)}
                    {allowsFraction(row.unit) ? ` por ${row.unit}` : " c/u"}
                  </span>
                ) : null}
              </span>
            </div>
          )}
        />
        <ColumnDirective
          field="quantity"
          headerText="Cant."
          headerTextAlign="Center"
          textAlign="Center"
          width={interactive ? 132 : 76}
          template={(row: PosCartGridItem) =>
            interactive ? (
              <div className="flex items-center justify-end gap-1">
                <button
                  aria-label={`Restar ${row.name}`}
                  className="flex size-11 items-center justify-center rounded-full text-slate-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-90"
                  onClick={() => onDecrease?.(row.productId)}
                  type="button"
                >
                  <Minus className="size-4" />
                </button>
                <span
                  className="min-w-8 text-center text-base font-black text-slate-950"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {quantityLabel(row)}
                </span>
                <button
                  aria-label={`Sumar ${row.name}`}
                  className="flex size-11 items-center justify-center rounded-full bg-primary text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-90"
                  onClick={() => onAdd?.(row.productId)}
                  type="button"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            ) : (
              <span
                className="text-sm font-bold text-slate-500"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {quantityLabel(row)}
              </span>
            )
          }
        />
        <ColumnDirective
          field="lineTotal"
          headerText="Total"
          headerTextAlign="Right"
          textAlign="Right"
          width={92}
          template={(row: PosCartGridItem) => (
            <span
              className="text-sm font-black text-slate-950"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {money(lineTotal(row.price, row.quantity))}
            </span>
          )}
        />
        {interactive ? (
          <ColumnDirective
            field="__actions"
            headerText=""
            textAlign="Center"
            width={56}
            template={(row: PosCartGridItem) => (
              <button
                aria-label={`Quitar ${row.name}`}
                className="flex size-11 items-center justify-center rounded-full text-slate-400 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-90 hover:text-rose-600"
                onClick={() => onRemove?.(row.productId)}
                type="button"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          />
        ) : null}
      </ColumnsDirective>
    </GridComponent>
  );
}
