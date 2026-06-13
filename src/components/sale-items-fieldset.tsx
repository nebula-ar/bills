"use client";

import { useState } from "react";

export type SaleServiceOption = {
  serviceId: string;
  label: string;
};

type SaleItemRow = {
  id: number;
};

type SaleItemsFieldsetProps = {
  serviceOptions: SaleServiceOption[];
  quantityInputClassName: string;
  selectClassName: string;
};

export function SaleItemsFieldset({
  serviceOptions,
  quantityInputClassName,
  selectClassName,
}: SaleItemsFieldsetProps) {
  const [nextRowId, setNextRowId] = useState(2);
  const [rows, setRows] = useState<SaleItemRow[]>([{ id: 1 }]);

  function addRow() {
    setRows((currentRows) => [...currentRows, { id: nextRowId }]);
    setNextRowId((currentId) => currentId + 1);
  }

  function removeRow(rowId: number) {
    setRows((currentRows) => {
      if (currentRows.length === 1) {
        return currentRows;
      }

      return currentRows.filter((row) => row.id !== rowId);
    });
  }

  return (
    <div className="grid gap-4 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-zinc-200">Servicios de la venta</p>
        <button
          className="rounded-lg border border-amber-400 px-3 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-400 hover:text-zinc-950"
          type="button"
          onClick={addRow}
        >
          Agregar servicio
        </button>
      </div>

      {rows.map((row, index) => (
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end" key={row.id}>
          <label className="grid gap-2 text-sm font-medium text-zinc-200">
            Servicio {index + 1}
            <select className={selectClassName} name="serviceId[]" required>
              <option value="">Seleccioná un servicio</option>
              {serviceOptions.map((serviceOption) => (
                <option key={serviceOption.serviceId} value={serviceOption.serviceId}>
                  {serviceOption.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium text-zinc-200">
            Cantidad
            <input
              className={quantityInputClassName}
              defaultValue={1}
              min={1}
              name="quantity[]"
              required
              step={1}
              type="number"
            />
          </label>

          <button
            className="rounded-lg border border-zinc-700 px-3 py-3 text-sm font-semibold text-zinc-300 hover:border-red-500 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-zinc-700 disabled:hover:text-zinc-300"
            disabled={rows.length === 1}
            type="button"
            onClick={() => removeRow(row.id)}
          >
            Quitar
          </button>
        </div>
      ))}
    </div>
  );
}
