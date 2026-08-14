"use client";

// Listado de clientes con Syncfusion EJ2 DataGrid (ej2-grids). Reemplaza la
// tabla custom de la pantalla Clientes por un grid real: ordena columnas,
// filtra (menú por columna + buscador del toolbar), pagina y exporta a Excel.
// El alta de cliente vive en un Dialog (ej2-popups) y el borrado confirma en
// otro Dialog — los dos con textos en español (locale global `es`).
//
// La grilla de acciones del toolbar (nuevo / exportar / refrescar) es el
// Toolbar de EJ2 que pide el plan de migración; el "Refrescar" recarga el
// árbol del servidor para que los cambios de otros lados (caja, ventas)
// aparezcan sin recargar la página.
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  ColumnDirective,
  ColumnsDirective,
  ExcelExport,
  Filter,
  GridComponent,
  Inject,
  Page,
  Sort,
  Toolbar,
} from "@syncfusion/ej2-react-grids";
import type { ClickEventArgs } from "@syncfusion/ej2-navigations";
import { DialogComponent } from "@syncfusion/ej2-react-popups";

import { Field, formatMoney, inputClass } from "@/components/manager-ui";
import { MoneyInput } from "@/components/money-input";
import { SyncSwitch } from "@/components/sync-switch";

export type CustomersGridRow = {
  id: string;
  name: string;
  /** Teléfono, CUIT o "Sin datos de contacto", ya resuelto para mostrar. */
  contact: string;
  salesCount: number;
  balance: number;
  overLimit: boolean;
  active: boolean;
};

type CustomersGridProps = {
  customers: CustomersGridRow[];
  /** Server action de alta: redirige con el mensaje (banner de la página). */
  createAction: (formData: FormData) => Promise<void>;
  /** Server action de borrado: devuelve { ok, message } sin redirigir. */
  deleteAction: (formData: FormData) => Promise<{ ok: boolean; message: string }>;
};

export function CustomersGrid({ customers, createAction, deleteAction }: CustomersGridProps) {
  const router = useRouter();
  const gridRef = useRef<GridComponent>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CustomersGridRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  function handleToolbarClick(args: ClickEventArgs) {
    switch (args.item.id) {
      case "nuevo":
        setCreateOpen(true);
        break;
      case "exportar":
        void gridRef.current?.excelExport();
        break;
      case "refrescar":
        router.refresh();
        break;
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const formData = new FormData();
      formData.set("customerId", deleteTarget.id);
      const result = await deleteAction(formData);
      if (!result.ok) throw new Error(result.message);
      toast.success(result.message);
      setDeleteTarget(null);
      router.refresh();
    } catch (error) {
      // El diálogo queda abierto para reintentar; el error se ve en el toast.
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar el cliente.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <GridComponent
        allowExcelExport
        allowFiltering
        allowPaging
        allowSorting
        allowTextWrap
        cssClass="e-gestion-grid e-dashboard-grid"
        dataSource={customers}
        emptyRecordTemplate={EmptyRecord}
        height="auto"
        pageSettings={{ pageSize: 8, pageSizes: [8, 16, 32] }}
        ref={gridRef}
        toolbar={TOOLBAR_ITEMS}
        toolbarClick={handleToolbarClick}
        width="100%"
      >
        <ColumnsDirective>
          <ColumnDirective
            field="name"
            headerText="Cliente"
            template={(row: CustomersGridRow) => (
              <div className="min-w-0 py-1">
                <Link
                  className="font-bold text-slate-950 hover:text-primary"
                  href={`/customers?customerId=${row.id}`}
                >
                  {row.name}
                </Link>
                <p className="text-xs text-slate-500">
                  {row.contact}
                  {row.active ? "" : " · inactivo"}
                </p>
              </div>
            )}
            width="45%"
          />
          <ColumnDirective
            field="salesCount"
            headerText="Compras"
            // En mobile se oculta Compras (secundaria): queda Cliente + Saldo +
            // acción. La query se escribe invertida porque la columna se
            // muestra cuando la media query MATCHES (mismo criterio que el
            // grid del dashboard).
            hideAtMedia="(min-width: 641px)"
            textAlign="Right"
            width={90}
          />
          <ColumnDirective
            field="balance"
            headerText="Saldo"
            template={(row: CustomersGridRow) =>
              row.balance > 0 ? (
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold ${
                    row.overLimit ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  Debe {formatMoney(row.balance)}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[0.7rem] font-bold text-emerald-800">
                  Al día
                </span>
              )
            }
            textAlign="Right"
            width={130}
          />
          <ColumnDirective
            headerText=""
            template={(row: CustomersGridRow) => (
              <button
                className="inline-flex min-h-9 items-center justify-center rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-black text-rose-600 transition hover:bg-rose-50 active:scale-95"
                onClick={() => setDeleteTarget(row)}
                type="button"
              >
                Eliminar
              </button>
            )}
            width={100}
          />
        </ColumnsDirective>
        <Inject services={[Page, Sort, Filter, Toolbar, ExcelExport]} />
      </GridComponent>

      {/* Alta de cliente en un Dialog. El form sigue siendo una server action:
          al confirmar redirige a /customers?status=success&message=… y la
          página muestra el banner de siempre. */}
      <DialogComponent
        close={() => setCreateOpen(false)}
        cssClass="e-gestion-dialog"
        header="Nuevo cliente"
        isModal
        showCloseIcon
        visible={createOpen}
        width="92%"
      >
        <form action={createAction} className="grid gap-3 sm:grid-cols-2">
          <Field className="sm:col-span-2" label="Nombre">
            <input className={inputClass} name="name" placeholder="Juan Pérez" required />
          </Field>
          <Field label="Teléfono">
            <input className={inputClass} name="phone" placeholder="11 5555-5555" />
          </Field>
          <Field label="CUIT / DNI">
            <input className={inputClass} name="taxId" placeholder="20123456789" />
          </Field>
          <Field hint="Vacío = sin tope" label="Límite de crédito">
            <MoneyInput className={inputClass} name="creditLimit" placeholder="$" />
          </Field>
          <Field label="Notas">
            <input className={inputClass} name="notes" placeholder="Pasa los martes" />
          </Field>
          <div className="flex items-center sm:col-span-2">
            <SyncSwitch defaultChecked label="Activo (puede comprar y fiar)" name="active" />
          </div>
          <div className="flex flex-col-reverse gap-2.5 sm:col-span-2 sm:flex-row sm:justify-end">
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 transition hover:bg-slate-50 active:scale-95"
              onClick={() => setCreateOpen(false)}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-sm transition hover:bg-primary-strong active:scale-95"
              type="submit"
            >
              Crear cliente
            </button>
          </div>
        </form>
      </DialogComponent>

      {/* Confirmación de borrado con Dialog de EJ2 (antes radix AlertDialog). */}
      <DialogComponent
        close={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        cssClass="e-gestion-dialog"
        header="¿Eliminar el cliente?"
        isModal
        showCloseIcon
        visible={deleteTarget !== null}
        width="92%"
      >
        <div className="flex flex-col gap-5">
          <p className="text-sm leading-6 text-slate-500">
            Se borra a <span className="font-black text-slate-950">{deleteTarget?.name}</span> y con él su
            historial y su saldo. No se puede deshacer.
          </p>
          <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 transition hover:bg-slate-50 active:scale-95"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-rose-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-rose-700 active:scale-95 disabled:opacity-70"
              disabled={deleting}
              onClick={() => void confirmDelete()}
              type="button"
            >
              {deleting ? "Borrando…" : "Sí, borrar"}
            </button>
          </div>
        </div>
      </DialogComponent>
    </>
  );
}

const TOOLBAR_ITEMS = [
  { id: "nuevo", text: "Nuevo cliente", tooltipText: "Nuevo cliente", prefixIcon: "e-plus" },
  { id: "exportar", text: "Exportar", tooltipText: "Exportar a Excel", prefixIcon: "e-export-excel" },
  { id: "refrescar", text: "Refrescar", tooltipText: "Refrescar", prefixIcon: "e-refresh" },
  "Search",
];

// Estado sin clientes: mismo mensaje que el EmptyState de antes, dentro del grid.
function EmptyRecord() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center">
      <p className="text-sm font-bold text-slate-700">Todavía no cargaste clientes.</p>
      <p className="mt-1 text-xs text-slate-500">Sirven para fiar, hacer seguimiento y facturar.</p>
    </div>
  );
}
